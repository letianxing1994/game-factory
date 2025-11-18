import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../utils/logger';

// 确保环境变量已加载
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10),
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'game_factory',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export type DBConnection = Omit<mysql.PoolConnection, 'execute'> & {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, mysql.FieldPacket[]]>;
};

export async function connectDatabase() {
  try {
    const connection = await pool.getConnection();
    logger.info('数据库连接测试成功');
    connection.release();
  } catch (error) {
    logger.error('数据库连接失败:', error);
    throw error;
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (error) {
    logger.error('数据库查询错误:', { sql, params, error });
    throw error;
  }
}

export async function getConnection(): Promise<DBConnection> {
  const connection = await pool.getConnection();
  return connection as DBConnection;
}

export { pool };