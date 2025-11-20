import { Router } from 'express';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { query, getConnection } from '../config/database';
import { sendMessage } from '../config/kafka';
import logger from '../utils/logger';

const router = Router();

// 获取游戏列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { companyId, status, page = '1', limit = '20', sort } = req.query;
    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 20;
    const offset = (pageNumber - 1) * pageSize;

    let sql = `
      SELECT g.*, c.name as company_name
      FROM games g
      JOIN companies c ON g.company_id = c.id
      WHERE 1 = 1
    `;

    const params: any[] = [];

    if (companyId) {
      sql += ' AND g.company_id = ?';
      params.push(companyId);
    }

    if (status) {
      sql += ' AND g.development_status = ?';
      params.push(status);
    }

    // 根据sort参数排序
    if (sort === 'popularity') {
      sql += ' ORDER BY g.popularity_score DESC, g.created_at DESC';
    } else if (sort === 'created_at') {
      sql += ' ORDER BY g.created_at DESC';
    } else {
      sql += ' ORDER BY g.created_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const games = await query<any[]>(sql, params);

    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    logger.error('获取游戏列表失败:', error);
    res.status(500).json({ success: false, message: '获取游戏列表失败' });
  }
});

// 获取我的公司游戏列表
router.get('/my-company', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const games = await query<any[]>(`
      SELECT g.*, c.name as company_name
      FROM games g
      JOIN companies c ON g.company_id = c.id
      WHERE c.owner_id = ?
      ORDER BY g.created_at DESC
    `, [req.user!.id]);

    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    logger.error('获取我的公司游戏列表失败:', error);
    res.status(500).json({ success: false, message: '获取我的公司游戏列表失败' });
  }
});

// 获取单个游戏
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const games = await query<any[]>(`
      SELECT g.*, c.name as company_name
      FROM games g
      JOIN companies c ON g.company_id = c.id
      WHERE g.id = ?
    `, [id]);

    if (!games.length) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }

    res.json({ success: true, data: games[0] });
  } catch (error) {
    logger.error('获取游戏详情失败:', error);
    res.status(500).json({ success: false, message: '获取游戏详情失败' });
  }
});

// 创建游戏项目
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  const connection = await getConnection();

  try {
    const { title, company_id, genre, description } = req.body;

    if (!title || !company_id || !genre) {
      return res.status(400).json({ success: false, message: '缺少必要字段' });
    }

    await connection.beginTransaction();

    const companyOwnership = await connection.execute<any[]>(
      'SELECT id FROM companies WHERE id = ? AND owner_id = ?',
      [company_id, req.user!.id]
    );

    if (!companyOwnership[0].length) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: '无权在该公司创建游戏' });
    }

    const [result] = await connection.execute<any>(
      `INSERT INTO games (name, company_id, genre, description, development_status)
       VALUES (?, ?, ?, ?, 'developing')`,
      [title, company_id, genre, description || null]
    );

    await connection.commit();

    await sendMessage('game-events', {
      type: 'game_created',
      gameId: result.insertId,
      companyId: company_id,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name: title,
        company_id,
        genre,
        description
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('创建游戏失败:', error);
    res.status(500).json({ success: false, message: '创建游戏失败' });
  } finally {
    connection.release();
  }
});

// 发布游戏
router.post('/:id/publish', authenticateToken, async (req: AuthRequest, res) => {
  const connection = await getConnection();

  try {
    const { id } = req.params;
    const { build_url, file_type } = req.body;

    await connection.beginTransaction();

    const games = await connection.execute<any[]>(
      `SELECT g.*, c.owner_id
       FROM games g
       JOIN companies c ON g.company_id = c.id
       WHERE g.id = ?`,
      [id]
    );

    if (!games[0].length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }

    const game = games[0][0];
    if (game.owner_id !== req.user!.id) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: '无权发布该游戏' });
    }

    await connection.execute(
      `UPDATE games 
       SET development_status = 'released',
           game_file_url = ?,
           game_file_type = ?,
           released_at = NOW()
       WHERE id = ?`,
      [build_url, file_type || 'web', id]
    );

    await connection.commit();

    await sendMessage('game-events', {
      type: 'game_published',
      gameId: id,
      companyId: game.company_id,
      buildUrl: build_url
    });

    res.json({ success: true, message: '游戏发布成功' });
  } catch (error) {
    await connection.rollback();
    logger.error('发布游戏失败:', error);
    res.status(500).json({ success: false, message: '发布游戏失败' });
  } finally {
    connection.release();
  }
});

// 记录游戏下载
router.post('/:id/download', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE games SET downloads_count = downloads_count + 1 WHERE id = ?',
      [id]
    );

    logger.info(`游戏 ${id} 下载次数+1`);

    res.json({ success: true, message: '下载记录成功' });
  } catch (error) {
    logger.error('记录游戏下载失败:', error);
    res.status(500).json({ success: false, message: '记录下载失败' });
  }
});

// 记录游戏播放/预览
router.post('/:id/play', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE games SET play_count = play_count + 1 WHERE id = ?',
      [id]
    );

    logger.info(`游戏 ${id} 播放次数+1`);

    res.json({ success: true, message: '播放记录成功' });
  } catch (error) {
    logger.error('记录游戏播放失败:', error);
    res.status(500).json({ success: false, message: '记录播放失败' });
  }
});

export default router;

