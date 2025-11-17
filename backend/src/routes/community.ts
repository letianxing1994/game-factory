import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validatePostCreation, validateCommentCreation } from '../middleware/validation';
import { query, getConnection } from '../config/database';
import { redisClient } from '../config/redis';
import { kafkaProducer } from '../config/kafka';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 创建社区帖子
router.post('/posts', authenticate, validatePostCreation, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const userId = req.user!.id;
    const { title, content, type, tags, gameId } = req.body;

    // 开始事务
    await connection.beginTransaction();

    // 创建帖子
    const result = await connection.execute(
      `INSERT INTO community_posts (user_id, title, content, type, tags, game_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, title, content, type, JSON.stringify(tags || []), gameId || null]
    );

    const postId = result[0].insertId;

    // 获取创建的帖子信息
    const posts = await connection.execute(`
      SELECT 
        cp.id,
        cp.title,
        cp.content,
        cp.type,
        cp.tags,
        cp.game_id,
        cp.created_at,
        cp.updated_at,
        u.id as user_id,
        u.username,
        u.avatar,
        COALESCE(likes.like_count, 0) as like_count,
        COALESCE(comments.comment_count, 0) as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN (SELECT post_id, COUNT(*) as like_count FROM post_likes WHERE status = 'active' GROUP BY post_id) likes ON cp.id = likes.post_id
      LEFT JOIN (SELECT post_id, COUNT(*) as comment_count FROM post_comments WHERE status = 'active' GROUP BY post_id) comments ON cp.id = comments.post_id
      WHERE cp.id = ?
    `, [postId]);

    await connection.commit();

    // 清除缓存
    await redisClient.del('community:posts:list');

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'community-events',
      messages: [{
        value: JSON.stringify({
          event: 'post_created',
          postId,
          userId,
          title,
          type,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 创建了社区帖子 ${postId}`);

    const post = posts[0][0];
    post.tags = JSON.parse(post.tags);

    res.json({
      success: true,
      message: '帖子创建成功',
      data: post
    });

  } catch (error) {
    await connection.rollback();
    logger.error('创建社区帖子失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建帖子失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取社区帖子列表
router.get('/posts', optionalAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      tag, 
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const cacheKey = `community:posts:${page}:${limit}:${type || 'all'}:${tag || 'all'}:${sortBy}:${sortOrder}`;

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
        cp.id,
        cp.title,
        cp.content,
        cp.type,
        cp.tags,
        cp.game_id,
        cp.created_at,
        cp.updated_at,
        u.id as user_id,
        u.username,
        u.avatar,
        COALESCE(likes.like_count, 0) as like_count,
        COALESCE(comments.comment_count, 0) as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN (SELECT post_id, COUNT(*) as like_count FROM post_likes WHERE status = 'active' GROUP BY post_id) likes ON cp.id = likes.post_id
      LEFT JOIN (SELECT post_id, COUNT(*) as comment_count FROM post_comments WHERE status = 'active' GROUP BY post_id) comments ON cp.id = comments.post_id
      WHERE cp.status = 'active'
    `;

    const params: any[] = [];

    if (type) {
      queryStr += ' AND cp.type = ?';
      params.push(type);
    }

    if (tag) {
      queryStr += ' AND cp.tags LIKE ?';
      params.push(`%"${tag}"%`);
    }

    // 排序
    const validSortFields = ['created_at', 'updated_at', 'like_count', 'comment_count'];
    const validSortOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder as string) ? sortOrder : 'desc';
    
    queryStr += ` ORDER BY ${sortField} ${sortDirection}`;
    queryStr += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const posts = await query(queryStr, params);

    // 获取总数
    let countQuery = `
      SELECT COUNT(*) as total
      FROM community_posts cp
      WHERE cp.status = 'active'
    `;
    
    const countParams: any[] = [];

    if (type) {
      countQuery += ' AND cp.type = ?';
      countParams.push(type);
    }

    if (tag) {
      countQuery += ' AND cp.tags LIKE ?';
      countParams.push(`%"${tag}"%`);
    }

    const totalResult = await query(countQuery, countParams);
    const total = totalResult[0].total;

    // 解析JSON字段
    const formattedPosts = posts.map(post => ({
      ...post,
      tags: JSON.parse(post.tags)
    }));

    const result = {
      posts: formattedPosts,
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
    logger.error('获取社区帖子列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取帖子列表失败' 
    });
  }
});

// 获取单个帖子详情
router.get('/posts/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `community:post:${id}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    const posts = await query(`
      SELECT 
        cp.id,
        cp.title,
        cp.content,
        cp.type,
        cp.tags,
        cp.game_id,
        cp.created_at,
        cp.updated_at,
        u.id as user_id,
        u.username,
        u.avatar,
        COALESCE(likes.like_count, 0) as like_count,
        COALESCE(comments.comment_count, 0) as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN (SELECT post_id, COUNT(*) as like_count FROM post_likes WHERE status = 'active' GROUP BY post_id) likes ON cp.id = likes.post_id
      LEFT JOIN (SELECT post_id, COUNT(*) as comment_count FROM post_comments WHERE status = 'active' GROUP BY post_id) comments ON cp.id = comments.post_id
      WHERE cp.id = ? AND cp.status = 'active'
    `, [id]);

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '帖子不存在' 
      });
    }

    const post = posts[0];
    post.tags = JSON.parse(post.tags);

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(post)); // 5分钟缓存

    res.json({
      success: true,
      data: post
    });

  } catch (error) {
    logger.error('获取帖子详情失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取帖子详情失败' 
    });
  }
});

// 点赞帖子
router.post('/posts/:id/like', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查帖子是否存在
    const postExists = await connection.execute(
      'SELECT id FROM community_posts WHERE id = ? AND status = "active"',
      [id]
    );

    if (Array.isArray(postExists[0]) && postExists[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '帖子不存在' 
      });
    }

    // 检查是否已经点赞
    const existingLike = await connection.execute(
      'SELECT id, status FROM post_likes WHERE post_id = ? AND user_id = ?',
      [id, userId]
    );

    let action: string;
    let message: string;

    if (Array.isArray(existingLike[0]) && existingLike[0].length > 0) {
      const like = existingLike[0][0];
      if (like.status === 'active') {
        // 取消点赞
        await connection.execute(
          'UPDATE post_likes SET status = "inactive" WHERE id = ?',
          [like.id]
        );
        action = 'unliked';
        message = '已取消点赞';
      } else {
        // 重新点赞
        await connection.execute(
          'UPDATE post_likes SET status = "active" WHERE id = ?',
          [like.id]
        );
        action = 'liked';
        message = '点赞成功';
      }
    } else {
      // 新点赞
      await connection.execute(
        'INSERT INTO post_likes (post_id, user_id, status, created_at) VALUES (?, ?, "active", NOW())',
        [id, userId]
      );
      action = 'liked';
      message = '点赞成功';
    }

    await connection.commit();

    // 清除缓存
    await redisClient.del(`community:post:${id}`);
    await redisClient.del('community:posts:list');

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'community-events',
      messages: [{
        value: JSON.stringify({
          event: 'post_like',
          postId: id,
          userId,
          action,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} ${action} 了帖子 ${id}`);

    res.json({
      success: true,
      message,
      action
    });

  } catch (error) {
    await connection.rollback();
    logger.error('点赞帖子失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '点赞失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 创建评论
router.post('/posts/:id/comments', authenticate, validateCommentCreation, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { content, parentId } = req.body;

    // 开始事务
    await connection.beginTransaction();

    // 检查帖子是否存在
    const postExists = await connection.execute(
      'SELECT id FROM community_posts WHERE id = ? AND status = "active"',
      [id]
    );

    if (Array.isArray(postExists[0]) && postExists[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '帖子不存在' 
      });
    }

    // 创建评论
    const result = await connection.execute(
      `INSERT INTO post_comments (post_id, user_id, content, parent_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [id, userId, content, parentId || null]
    );

    const commentId = result[0].insertId;

    // 获取创建的评论信息
    const comments = await connection.execute(`
      SELECT 
        pc.id,
        pc.content,
        pc.parent_id,
        pc.created_at,
        pc.updated_at,
        u.id as user_id,
        u.username,
        u.avatar
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.id = ?
    `, [commentId]);

    await connection.commit();

    // 清除缓存
    await redisClient.del(`community:post:${id}`);
    await redisClient.del('community:posts:list');

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'community-events',
      messages: [{
        value: JSON.stringify({
          event: 'comment_created',
          commentId,
          postId: id,
          userId,
          parentId: parentId || null,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 在帖子 ${id} 下创建了评论 ${commentId}`);

    const comment = comments[0][0];

    res.json({
      success: true,
      message: '评论创建成功',
      data: comment
    });

  } catch (error) {
    await connection.rollback();
    logger.error('创建评论失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建评论失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取帖子评论列表
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // 检查帖子是否存在
    const postExists = await query(
      'SELECT id FROM community_posts WHERE id = ? AND status = "active"',
      [id]
    );

    if (postExists.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '帖子不存在' 
      });
    }

    const comments = await query(`
      SELECT 
        pc.id,
        pc.content,
        pc.parent_id,
        pc.created_at,
        pc.updated_at,
        u.id as user_id,
        u.username,
        u.avatar
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = ? AND pc.status = 'active'
      ORDER BY pc.created_at ASC
      LIMIT ? OFFSET ?
    `, [id, Number(limit), offset]);

    // 获取总数
    const totalResult = await query(
      'SELECT COUNT(*) as total FROM post_comments WHERE post_id = ? AND status = "active"',
      [id]
    );
    const total = totalResult[0].total;

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('获取评论列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取评论列表失败' 
    });
  }
});

// 删除帖子
router.delete('/posts/:id', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查帖子所有权
    const postOwnership = await connection.execute(
      'SELECT id FROM community_posts WHERE id = ? AND user_id = ? AND status = "active"',
      [id, userId]
    );

    if (Array.isArray(postOwnership[0]) && postOwnership[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '帖子不存在或无权删除' 
      });
    }

    // 软删除帖子
    await connection.execute(
      'UPDATE community_posts SET status = "deleted" WHERE id = ?',
      [id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`community:post:${id}`);
    await redisClient.del('community:posts:list');

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'community-events',
      messages: [{
        value: JSON.stringify({
          event: 'post_deleted',
          postId: id,
          userId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 删除了帖子 ${id}`);

    res.json({
      success: true,
      message: '帖子删除成功'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('删除帖子失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除帖子失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取社区统计信息
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = 'community:stats';

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
        (SELECT COUNT(*) FROM community_posts WHERE status = 'active') as total_posts,
        (SELECT COUNT(*) FROM post_comments WHERE status = 'active') as total_comments,
        (SELECT COUNT(*) FROM post_likes WHERE status = 'active') as total_likes,
        (SELECT COUNT(*) FROM community_posts WHERE status = 'active' AND type = 'share') as share_posts,
        (SELECT COUNT(*) FROM community_posts WHERE status = 'active' AND type = 'question') as question_posts,
        (SELECT COUNT(*) FROM community_posts WHERE status = 'active' AND type = 'discussion') as discussion_posts,
        (SELECT COUNT(*) FROM community_posts WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as posts_24h,
        (SELECT COUNT(*) FROM post_comments WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as comments_24h
    `);

    const result = stats[0];

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5分钟缓存

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('获取社区统计信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取统计信息失败' 
    });
  }
});

export default router;