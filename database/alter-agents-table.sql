-- 重构agents表结构
-- 执行时间：2025-11-19
-- 目的：简化agents表，移除冗余字段，让字段更具实际意义

USE mydb;

-- 1. 删除冗余字段（静默忽略不存在的列）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='education') > 0, 'ALTER TABLE agents DROP COLUMN education', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='skills') > 0, 'ALTER TABLE agents DROP COLUMN skills', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='experience_level') > 0, 'ALTER TABLE agents DROP COLUMN experience_level', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='efficiency_score') > 0, 'ALTER TABLE agents DROP COLUMN efficiency_score', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='creativity_score') > 0, 'ALTER TABLE agents DROP COLUMN creativity_score', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='teamwork_score') > 0, 'ALTER TABLE agents DROP COLUMN teamwork_score', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='salary_cost') > 0, 'ALTER TABLE agents DROP COLUMN salary_cost', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='is_on_market') > 0, 'ALTER TABLE agents DROP COLUMN is_on_market', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='market_price') > 0, 'ALTER TABLE agents DROP COLUMN market_price', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 添加新字段：额外特点（影响提示词）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND COLUMN_NAME='extra_traits') = 0, 'ALTER TABLE agents ADD COLUMN extra_traits TEXT COMMENT ''额外特点（影响提示词）：如"擅长C++性能优化"、"精通像素艺术风格"等'' AFTER specialization', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. 修改字段注释，明确字段实际用途
ALTER TABLE agents MODIFY COLUMN ai_model VARCHAR(50) COMMENT 'AI模型：DeepSeek-R1, GPT-5, Claude-Sonnet-4.5, DALL-E-3, Meshy-4等（为空时使用配置默认模型）';
ALTER TABLE agents MODIFY COLUMN specialization VARCHAR(100) COMMENT '专业方向：策划=RPG/MOBA/SLG等，美术=realistic/cartoon/pixel等，技术=singleplayer/multiplayer等';
ALTER TABLE agents MODIFY COLUMN type VARCHAR(20) NOT NULL COMMENT '员工类型：planner-策划，artist-美术，developer-技术，tester-测试，music-音乐';
ALTER TABLE agents MODIFY COLUMN status VARCHAR(20) DEFAULT 'employed' COMMENT '状态：employed-在职，available-待业';

-- 4. 删除不再需要的索引（静默忽略不存在的索引）
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA='mydb' AND TABLE_NAME='agents' AND INDEX_NAME='idx_on_market') > 0, 'ALTER TABLE agents DROP INDEX idx_on_market', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 验证结果
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'mydb' 
  AND TABLE_NAME = 'agents'
ORDER BY ORDINAL_POSITION;
