import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// 生成JWT令牌
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email 
    },
    (process.env['JWT_SECRET'] || 'default-secret') as jwt.Secret,
    { expiresIn: process.env['JWT_EXPIRES_IN'] || '7d' } as SignOptions
  );
}

// 验证JWT令牌
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, (process.env['JWT_SECRET'] || 'default-secret') as jwt.Secret) as AuthUser;
    return decoded;
  } catch (error) {
    logger.error('JWT验证失败:', error);
    return null;
  }
}

// JWT认证中间件
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: '访问令牌缺失' });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(403).json({ error: '访问令牌无效' });
    return;
  }

  req.user = user;
  next();
}

// 可选认证中间件（不强制要求认证）
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

export const authenticate = authenticateToken;