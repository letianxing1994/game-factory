// 测试games.ts修改后的query参数
const mysql = require('mysql2/promise');

async function testQuery() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    database: 'mydb',
    user: 'root',
    password: '4215628@Tim',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    // 模拟修复后的代码：parseInt转换
    const pageSize = parseInt('10');
    const offset = parseInt('0');
    
    console.log(`参数类型 - pageSize: ${typeof pageSize} (${pageSize}), offset: ${typeof offset} (${offset})`);
    
    const sql = `
      SELECT g.*, c.name as company_name
      FROM games g
      JOIN companies c ON g.company_id = c.id
      WHERE 1 = 1
      ORDER BY g.popularity_score DESC, g.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    
    const [rows] = await pool.query(sql);
    console.log(`✅ 成功！返回 ${rows.length} 条数据`);
    if (rows.length > 0) {
      console.log('第一条:', rows[0].name, rows[0].genre);
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await pool.end();
  }
}

testQuery();
