require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Host:', process.env.DB_HOST);
    console.log('Port:', process.env.DB_PORT);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Database connection successful!');
    
    const [rows] = await conn.query('SELECT 1 as test');
    console.log('✅ Query test successful!', rows);
    
    const [tables] = await conn.query('SHOW TABLES');
    console.log('✅ Tables in database:', tables.length);
    
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    console.error('Error code:', e.code);
    console.error('Error stack:', e.stack);
    process.exit(1);
  }
}

testConnection();

