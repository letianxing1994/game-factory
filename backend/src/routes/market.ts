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
        ml.id as listing_id,
        ml.price,
        ml.description as listing_description,
        ml.created_at as listing_created_at,
        ea.id as agent_id,
        ea.name as agent_name,
        ea.type as agent_type,
        ea.specialization,
        ea.skills,
        ea.experience,
        ea.education,
        ea.traits,
        u.id as seller_id,
        u.username as seller_name
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      JOIN users u ON ml.seller_id = u.id
      WHERE ml.status = 'active'
    `;

    const params: any[] = [];

    if (type) {
      queryStr += ' AND ea.type = ?';
      params.push(type);
    }

    if (specialization) {
      queryStr += ' AND ea.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }

    if (minPrice) {
      queryStr += ' AND ml.price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      queryStr += ' AND ml.price <= ?';
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
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      WHERE ml.status = 'active'
    `;
    
    const countParams: any[] = [];

    if (type) {
      countQuery += ' AND ea.type = ?';
      countParams.push(type);
    }

    if (specialization) {
      countQuery += ' AND ea.specialization LIKE ?';
      countParams.push(`%${specialization}%`);
    }

    if (minPrice) {
      countQuery += ' AND ml.price >= ?';
      countParams.push(Number(minPrice));
    }

    if (maxPrice) {
      countQuery += ' AND ml.price <= ?';
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
        ml.id as listing_id,
        ml.price,
        ml.description as listing_description,
        ml.created_at as listing_created_at,
        ea.id as agent_id,
        ea.name as agent_name,
        ea.type as agent_type,
        ea.specialization,
        ea.skills,
        ea.experience,
        ea.education,
        ea.traits,
        ea.salary_requirement,
        u.id as seller_id,
        u.username as seller_name,
        u.reputation as seller_reputation
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      JOIN users u ON ml.seller_id = u.id
      WHERE ml.id = ? AND ml.status = 'active'
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
      SELECT ml.*, ea.owner_id as seller_id, ea.salary_requirement
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      WHERE ml.id = ? AND ml.status = 'active'
    `, [id]);

    if (Array.isArray(listingInfo[0]) && listingInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '市场列表不存在或已下架' 
      });
    }

    const listing = listingInfo[0][0];

    // 检查是否购买自己的员工
    if (listing.seller_id === buyerId) {
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
        'SELECT COUNT(*) as count FROM company_employees WHERE company_id = ? AND status = "active"',
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
      'SELECT balance FROM user_coins WHERE user_id = ?',
      [buyerId]
    );

    const currentBalance = buyerBalance[0][0]?.balance || 0;
    
    if (currentBalance < listing.price) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '游戏币余额不足，无法购买' 
      });
    }

    // 扣除买家游戏币
    await connection.execute(
      'UPDATE user_coins SET balance = balance - ? WHERE user_id = ?',
      [listing.price, buyerId]
    );

    // 增加卖家游戏币
    await connection.execute(
      'UPDATE user_coins SET balance = balance + ? WHERE user_id = ?',
      [listing.price, listing.seller_id]
    );

    // 更新市场列表状态
    await connection.execute(
      'UPDATE market_listings SET status = "sold", buyer_id = ?, sold_at = NOW() WHERE id = ?',
      [buyerId, id]
    );

    // 更新员工所有权
    await connection.execute(
      'UPDATE employee_agents SET owner_id = ?, status = "active", updated_at = NOW() WHERE id = ?',
      [buyerId, listing.employee_id]
    );

    // 添加到公司（如果指定了公司）
    if (companyId) {
      await connection.execute(
        `INSERT INTO company_employees (company_id, employee_id, position, salary, status)
         VALUES (?, ?, (SELECT type FROM employee_agents WHERE id = ?), ?, 'active')`,
        [companyId, listing.employee_id, listing.employee_id, listing.salary_requirement]
      );
    }

    // 记录买家游戏币交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, type, amount, description, 
        related_entity_type, related_entity_id) 
       VALUES (?, 'agent_purchase', -?, '购买员工Agent', 'market_listing', ?)`,
      [buyerId, listing.price, id]
    );

    // 记录卖家游戏币交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, type, amount, description, 
        related_entity_type, related_entity_id) 
       VALUES (?, 'agent_sale', ?, '出售员工Agent', 'market_listing', ?)`,
      [listing.seller_id, listing.price, id]
    );

    await connection.commit();

    // 清除相关缓存
    await redisClient.del(`market:listing:${id}`);
    await redisClient.del(`user:${buyerId}:agents`);
    await redisClient.del(`user:${buyerId}:balance`);
    await redisClient.del(`user:${listing.seller_id}:agents`);
    await redisClient.del(`user:${listing.seller_id}:balance`);
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
          sellerId: listing.seller_id,
          agentId: listing.employee_id,
          price: listing.price,
          companyId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${buyerId} 购买了员工Agent ${listing.employee_id}，价格: ${listing.price}`);

    res.json({
      success: true,
      message: '员工Agent购买成功',
      data: {
        agentId: listing.employee_id,
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
      SELECT ml.*, ea.id as agent_id
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      WHERE ml.id = ? AND ml.seller_id = ? AND ml.status = 'active'
    `, [id, userId]);

    if (Array.isArray(listingInfo[0]) && listingInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '市场列表不存在或无权下架' 
      });
    }

    const listing = listingInfo[0][0];

    // 更新市场列表状态
    await connection.execute(
      'UPDATE market_listings SET status = "cancelled" WHERE id = ?',
      [id]
    );

    // 更新员工状态
    await connection.execute(
      'UPDATE employee_agents SET status = "active", updated_at = NOW() WHERE id = ?',
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
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active') as total_active_listings,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'sold' AND sold_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as sold_24h,
        (SELECT AVG(price) FROM market_listings WHERE status = 'sold' AND sold_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as avg_price_24h,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active' AND employee_id IN (SELECT id FROM employee_agents WHERE type = 'planner')) as planner_listings,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active' AND employee_id IN (SELECT id FROM employee_agents WHERE type = 'artist')) as artist_listings,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active' AND employee_id IN (SELECT id FROM employee_agents WHERE type = 'developer')) as developer_listings,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active' AND employee_id IN (SELECT id FROM employee_agents WHERE type = 'tester')) as tester_listings,
        (SELECT COUNT(*) FROM market_listings WHERE status = 'active' AND employee_id IN (SELECT id FROM employee_agents WHERE type = 'operator')) as operator_listings
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
        ml.id as listing_id,
        ml.price,
        ml.description as listing_description,
        ml.created_at as listing_created_at,
        ea.id as agent_id,
        ea.name as agent_name,
        ea.type as agent_type,
        ea.specialization,
        ea.skills,
        ea.experience,
        ea.education,
        ea.traits,
        u.id as seller_id,
        u.username as seller_name
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      JOIN users u ON ml.seller_id = u.id
      WHERE ml.status = 'active' AND (ea.name LIKE ? OR ea.specialization LIKE ?)
    `;

    const params: any[] = [searchTerm, searchTerm];

    if (type) {
      queryStr += ' AND ea.type = ?';
      params.push(type);
    }

    if (minExperience) {
      queryStr += ' AND ea.experience >= ?';
      params.push(Number(minExperience));
    }

    if (maxExperience) {
      queryStr += ' AND ea.experience <= ?';
      params.push(Number(maxExperience));
    }

    queryStr += ' ORDER BY ml.created_at DESC';
    queryStr += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const listings = await query(queryStr, params);

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM market_listings ml
      JOIN employee_agents ea ON ml.employee_id = ea.id
      WHERE ml.status = 'active' AND (ea.name LIKE ? OR ea.specialization LIKE ?)
    `;
    
    const countParams: any[] = [searchTerm, searchTerm];

    if (type) {
      countQuery += ' AND ea.type = ?';
      countParams.push(type);
    }

    if (minExperience) {
      countQuery += ' AND ea.experience >= ?';
      countParams.push(Number(minExperience));
    }

    if (maxExperience) {
      countQuery += ' AND ea.experience <= ?';
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