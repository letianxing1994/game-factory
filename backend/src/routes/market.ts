import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query, getConnection } from '../config/database';
import { redisClient } from '../config/redis';
import { kafkaProducer } from '../config/kafka';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 获取市场列表
router.get('/listings', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      specialization, 
      minPrice, 
      maxPrice, 
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const cacheKey = `market:listings:${page}:${limit}:${type || 'all'}:${specialization || 'all'}:${minPrice || '0'}:${maxPrice || 'max'}:${sortBy}:${sortOrder}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    let queryStr = `
      SELECT 
        mt.id as listing_id,
        mt.price,
        mt.created_at as listing_created_at,
        a.id as agent_id,
        a.name as agent_name,
        a.type as agent_type,
        a.specialization,
        a.skills,
        a.experience,
        a.education,
        a.traits,
        u.id as seller_id,
        u.username as seller_name
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      JOIN users u ON mt.seller_id = u.id
      WHERE mt.status = 'active' AND a.is_on_market = TRUE
    `;

    const params: any[] = [];

    if (type) {
      queryStr += ' AND a.type = ?';
      params.push(type);
    }

    if (specialization) {
      queryStr += ' AND a.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }

    if (minPrice) {
      queryStr += ' AND mt.price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      queryStr += ' AND mt.price <= ?';
      params.push(Number(maxPrice));
    }

    // 排序
    const validSortFields = ['price', 'created_at', 'experience'];
    const validSortOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder as string) ? sortOrder : 'desc';
    
    queryStr += ` ORDER BY ${sortField} ${sortDirection}`;
    queryStr += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const listings = await query(queryStr, params);

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      WHERE mt.status = 'active' AND a.is_on_market = TRUE
    `;
    
    const countParams: any[] = [];

    if (type) {
      countQuery += ' AND a.type = ?';
      countParams.push(type);
    }

    if (specialization) {
      countQuery += ' AND a.specialization LIKE ?';
      countParams.push(`%${specialization}%`);
    }

    if (minPrice) {
      countQuery += ' AND mt.price >= ?';
      countParams.push(Number(minPrice));
    }

    if (maxPrice) {
      countQuery += ' AND mt.price <= ?';
      countParams.push(Number(maxPrice));
    }

    const totalResult = await query(countQuery, countParams);
    const total = totalResult[0].total;

    // 解析JSON字段
    const formattedListings = listings.map(listing => ({
      ...listing,
      skills: listing.skills ? JSON.parse(listing.skills) : [],
      traits: listing.traits ? JSON.parse(listing.traits) : []
    }));

    const result = {
      listings: formattedListings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    };

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5分钟缓存

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('获取市场列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取市场列表失败' 
    });
  }
});

// 获取市场列表详情
router.get('/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `market:listing:${id}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    const listings = await query(`
      SELECT 
        mt.id as listing_id,
        mt.price,
        mt.created_at as listing_created_at,
        a.id as agent_id,
        a.name as agent_name,
        a.type as agent_type,
        a.specialization,
        a.skills,
        a.experience,
        a.education,
        a.traits,
        a.salary_cost as salary_requirement,
        u.id as seller_id,
        u.username as seller_name,
        u.reputation as seller_reputation
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      JOIN users u ON mt.seller_id = u.id
      WHERE mt.id = ? AND mt.status = 'active' AND a.is_on_market = TRUE
    `, [id]);

    if (listings.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '市场列表不存在或已下架' 
      });
    }

    const listing = listings[0];

    // 解析JSON字段
    const formattedListing = {
      ...listing,
      skills: listing.skills ? JSON.parse(listing.skills) : [],
      traits: listing.traits ? JSON.parse(listing.traits) : []
    };

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(formattedListing)); // 5分钟缓存

    res.json({
      success: true,
      data: formattedListing
    });

  } catch (error) {
    logger.error('获取市场列表详情失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取市场列表详情失败' 
    });
  }
});

// 购买员工Agent
router.post('/listings/:id/buy', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const buyerId = req.user!.id;
    const { companyId } = req.body;

    // 开始事务
    await connection.beginTransaction();

    // 获取市场列表信息
    const listingInfo = await connection.execute(`
      SELECT mt.*, a.company_id, a.salary_cost as salary_requirement
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      WHERE mt.id = ? AND mt.status = 'active' AND a.is_on_market = TRUE
    `, [id]);

    if (Array.isArray(listingInfo[0]) && listingInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '市场列表不存在或已下架' 
      });
    }

    const listing = listingInfo[0][0];
    const sellerId = listing.seller_id;

    // 检查是否购买自己的员工
    if (sellerId === buyerId) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '不能购买自己的员工' 
      });
    }

    // 检查买家公司
    if (companyId) {
      const companyOwnership = await connection.execute(
        'SELECT id, max_employees FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
        [companyId, buyerId]
      );

      if (Array.isArray(companyOwnership[0]) && companyOwnership[0].length === 0) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: '无权在此公司添加员工' 
        });
      }

      // 检查公司是否已满员
      const employeeCount = await connection.execute(
        'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
        [companyId]
      );

      const maxEmployees = companyOwnership[0][0].max_employees;
      if (employeeCount[0][0].count >= maxEmployees) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: '公司已达到最大员工数量限制' 
        });
      }
    }

    // 检查买家游戏币余额
    const buyerBalance = await connection.execute(
      'SELECT game_coins FROM users WHERE id = ?',
      [buyerId]
    );

    const currentBalance = buyerBalance[0][0]?.game_coins || 0;
    
    if (currentBalance < listing.price) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '游戏币余额不足，无法购买' 
      });
    }

    // 扣除买家游戏币
    await connection.execute(
      'UPDATE users SET game_coins = game_coins - ? WHERE id = ?',
      [listing.price, buyerId]
    );

    // 增加卖家游戏币
    await connection.execute(
      'UPDATE users SET game_coins = game_coins + ? WHERE id = ?',
      [listing.price, sellerId]
    );

    // 更新市场交易状态
    await connection.execute(
      'UPDATE market_transactions SET status = "sold", buyer_id = ?, sold_at = NOW() WHERE id = ?',
      [buyerId, id]
    );

    // 更新员工状态和所有权
    await connection.execute(
      'UPDATE agents SET is_on_market = FALSE, status = "employed", company_id = ?, updated_at = NOW() WHERE id = ?',
      [companyId || null, listing.agent_id]
    );

    // 记录买家游戏币交易
    const buyerBalanceAfter = currentBalance - listing.price;
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
        related_type, related_id) 
       VALUES (?, 'spend', ?, ?, '购买员工Agent', 'agent', ?)`,
      [buyerId, listing.price, buyerBalanceAfter, listing.agent_id]
    );

    // 记录卖家游戏币交易
    const sellerResult = await connection.execute('SELECT game_coins FROM users WHERE id = ?', [sellerId]);
    const sellerBalanceAfter = (sellerResult[0][0]?.game_coins || 0) + listing.price;
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
        related_type, related_id) 
       VALUES (?, 'earn', ?, ?, '出售员工Agent', 'agent', ?)`,
      [sellerId, listing.price, sellerBalanceAfter, listing.agent_id]
    );

    await connection.commit();

    // 清除相关缓存
    await redisClient.del(`market:listing:${id}`);
    await redisClient.del(`user:${buyerId}:agents`);
    await redisClient.del(`user:${buyerId}:balance`);
    await redisClient.del(`user:${sellerId}:agents`);
    await redisClient.del(`user:${sellerId}:balance`);
    if (companyId) {
      await redisClient.del(`company:${companyId}:employees`);
    }

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'market-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_purchased',
          listingId: id,
          buyerId,
          sellerId: sellerId,
          agentId: listing.agent_id,
          price: listing.price,
          companyId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${buyerId} 购买了员工Agent ${listing.agent_id}，价格: ${listing.price}`);

    res.json({
      success: true,
      message: '员工Agent购买成功',
      data: {
        agentId: listing.agent_id,
        price: listing.price,
        companyId
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('购买员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '购买员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 下架员工Agent
router.post('/listings/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查市场列表所有权
    const listingInfo = await connection.execute(`
      SELECT mt.*, mt.agent_id
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      WHERE mt.id = ? AND mt.seller_id = ? AND mt.status = 'active'
    `, [id, userId]);

    if (Array.isArray(listingInfo[0]) && listingInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '市场列表不存在或无权下架' 
      });
    }

    const listing = listingInfo[0][0];

    // 更新市场交易状态
    await connection.execute(
      'UPDATE market_transactions SET status = "cancelled" WHERE id = ?',
      [id]
    );

    // 更新agent上架状态
    await connection.execute(
      'UPDATE agents SET is_on_market = FALSE, updated_at = NOW() WHERE id = ?',
      [listing.agent_id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`market:listing:${id}`);
    await redisClient.del(`user:${userId}:agents`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'market-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_listing_cancelled',
          listingId: id,
          userId,
          agentId: listing.agent_id,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 下架了员工Agent ${listing.agent_id} 的市场列表 ${id}`);

    res.json({
      success: true,
      message: '员工Agent已下架'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('下架员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '下架员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取市场统计信息
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = 'market:stats';

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM market_transactions WHERE status = 'active') as total_active_listings,
        (SELECT COUNT(*) FROM market_transactions WHERE status = 'sold' AND sold_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as sold_24h,
        (SELECT AVG(price) FROM market_transactions WHERE status = 'sold' AND sold_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as avg_price_24h,
        (SELECT COUNT(*) FROM market_transactions mt JOIN agents a ON mt.agent_id = a.id WHERE mt.status = 'active' AND a.type = 'planner') as planner_listings,
        (SELECT COUNT(*) FROM market_transactions mt JOIN agents a ON mt.agent_id = a.id WHERE mt.status = 'active' AND a.type = 'artist') as artist_listings,
        (SELECT COUNT(*) FROM market_transactions mt JOIN agents a ON mt.agent_id = a.id WHERE mt.status = 'active' AND a.type = 'developer') as developer_listings,
        (SELECT COUNT(*) FROM market_transactions mt JOIN agents a ON mt.agent_id = a.id WHERE mt.status = 'active' AND a.type = 'tester') as tester_listings,
        (SELECT COUNT(*) FROM market_transactions mt JOIN agents a ON mt.agent_id = a.id WHERE mt.status = 'active' AND a.type = 'operator') as operator_listings
    `);

    const result = stats[0];

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5分钟缓存

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('获取市场统计信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取市场统计信息失败' 
    });
  }
});

// 搜索市场列表
router.get('/search', async (req, res) => {
  try {
    const { 
      q, 
      page = 1, 
      limit = 20, 
      type, 
      minExperience, 
      maxExperience 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = `%${q}%`;
    const cacheKey = `market:search:${q}:${page}:${limit}:${type || 'all'}:${minExperience || '0'}:${maxExperience || 'max'}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    let queryStr = `
      SELECT 
        mt.id as listing_id,
        mt.price,
        mt.created_at as listing_created_at,
        a.id as agent_id,
        a.name as agent_name,
        a.type as agent_type,
        a.specialization,
        a.skills,
        a.experience,
        a.education,
        a.traits,
        u.id as seller_id,
        u.username as seller_name
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      JOIN users u ON mt.seller_id = u.id
      WHERE mt.status = 'active' AND a.is_on_market = TRUE AND (a.name LIKE ? OR a.specialization LIKE ?)
    `;

    const params: any[] = [searchTerm, searchTerm];

    if (type) {
      queryStr += ' AND a.type = ?';
      params.push(type);
    }

    if (minExperience) {
      queryStr += ' AND a.experience >= ?';
      params.push(Number(minExperience));
    }

    if (maxExperience) {
      queryStr += ' AND a.experience <= ?';
      params.push(Number(maxExperience));
    }

    queryStr += ' ORDER BY mt.created_at DESC';
    queryStr += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const listings = await query(queryStr, params);

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM market_transactions mt
      JOIN agents a ON mt.agent_id = a.id
      WHERE mt.status = 'active' AND a.is_on_market = TRUE AND (a.name LIKE ? OR a.specialization LIKE ?)
    `;
    
    const countParams: any[] = [searchTerm, searchTerm];

    if (type) {
      countQuery += ' AND a.type = ?';
      countParams.push(type);
    }

    if (minExperience) {
      countQuery += ' AND a.experience >= ?';
      countParams.push(Number(minExperience));
    }

    if (maxExperience) {
      countQuery += ' AND a.experience <= ?';
      countParams.push(Number(maxExperience));
    }

    const totalResult = await query(countQuery, countParams);
    const total = totalResult[0].total;

    // 解析JSON字段
    const formattedListings = listings.map(listing => ({
      ...listing,
      skills: listing.skills ? JSON.parse(listing.skills) : [],
      traits: listing.traits ? JSON.parse(listing.traits) : []
    }));

    const result = {
      listings: formattedListings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    };

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5分钟缓存

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('搜索市场列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '搜索市场列表失败' 
    });
  }
});

export default router;