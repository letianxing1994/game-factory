import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// 配置 multer 用于文件上传（临时存储）
const upload = multer({
  storage: multer.memoryStorage(), // 使用内存存储，稍后根据环境决定保存位置
  limits: {
    fileSize: 10 * 1024 * 1024, // 最大 10MB
  },
  fileFilter: (req, file, cb) => {
    // 验证文件类型
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式，仅支持 JPG, PNG, GIF, WEBP'));
    }
  },
});

/**
 * 生成存储键
 * 格式：concept-images/user_{userId}/company_{companyId}/game_{gameId}/{category}/{timestamp}_{random}.{ext}
 */
function generateStorageKey(
  userId: number,
  companyId?: number,
  gameId?: number,
  category?: string,
  ext?: string
): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);

  const pathParts = ['concept-images', `user_${userId}`];

  if (companyId) {
    pathParts.push(`company_${companyId}`);
  }

  if (gameId) {
    pathParts.push(`game_${gameId}`);
  }

  if (category) {
    pathParts.push(category);
  }

  const filename = `${timestamp}_${randomStr}${ext || ''}`;
  pathParts.push(filename);

  return path.join(...pathParts);
}

/**
 * 保存文件到本地data文件夹（开发/测试环境）
 */
async function saveToLocal(
  file: Express.Multer.File,
  storageKey: string
): Promise<string> {
  const dataDir = './data';
  const fullPath = path.join(dataDir, storageKey);

  // 创建目录（递归）
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // 写入文件（从内存）
  await fs.writeFile(fullPath, file.buffer);

  // 返回相对路径作为URL
  const relativeURL = `/data/${storageKey.replace(/\\/g, '/')}`;
  return relativeURL;
}

/**
 * 上传文件到云存储（生产环境）
 */
async function uploadToOSS(
  file: Express.Multer.File,
  storageKey: string
): Promise<string> {
  // TODO: 实现OSS上传逻辑
  // 这里可以根据配置选择不同的云存储服务商：
  // - 阿里云 OSS
  // - Google Cloud Storage
  // - AWS S3

  throw new Error('云存储功能尚未配置，请在开发环境下测试或配置OSS服务');

  /*
  // 示例代码（阿里云OSS）：
  import OSS from 'ali-oss';

  const client = new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
  });

  const result = await client.put(storageKey, file.buffer);
  return result.url;
  */
}

/**
 * 上传游戏概念图
 * POST /api/upload/concept-image
 */
router.post(
  '/concept-image',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件',
        });
      }

      // 解析表单参数
      const companyId = req.body.company_id ? parseInt(req.body.company_id) : undefined;
      const gameId = req.body.game_id ? parseInt(req.body.game_id) : undefined;
      const category = req.body.category || 'general';

      // 获取文件扩展名
      const ext = path.extname(file.originalname).toLowerCase();

      // 生成存储键
      const storageKey = generateStorageKey(userId, companyId, gameId, category, ext);

      // 根据环境选择存储方式
      const env = process.env.NODE_ENV || 'development';
      let fileURL: string;

      if (env === 'production') {
        // 生产环境：上传到OSS
        fileURL = await uploadToOSS(file, storageKey);
      } else {
        // 开发/测试环境：保存到本地
        fileURL = await saveToLocal(file, storageKey);
      }

      logger.info(`用户 ${userId} 上传概念图成功: ${fileURL}`);

      res.json({
        success: true,
        message: '概念图上传成功',
        data: {
          url: fileURL,
          filename: file.originalname,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('上传概念图失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '上传失败，请重试',
      });
    }
  }
);

export default router;
