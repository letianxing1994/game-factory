-- 为3D美术Agent添加双模型支持
-- 执行时间：2025-11-20
-- 目的：ai_model字段拆分为ai_model_2d和ai_model_3d，支持3D美术使用两个模型

USE mydb;

-- 1. 添加新字段
ALTER TABLE agents 
  ADD COLUMN ai_model_2d VARCHAR(50) COMMENT '2D模型（用于生成原画/贴图）：DALL-E-3, Midjourney等' AFTER ai_model;

ALTER TABLE agents 
  ADD COLUMN ai_model_3d VARCHAR(50) COMMENT '3D模型（用于生成3D资产）：Meshy-4, Luma AI等' AFTER ai_model_2d;

-- 2. 迁移现有数据：将ai_model的值复制到对应字段
-- 对于2D美术，复制到ai_model_2d
UPDATE agents 
SET ai_model_2d = ai_model 
WHERE type = 'artist' AND dimension = '2d' AND ai_model IS NOT NULL;

-- 对于3D美术，默认设置两个模型
UPDATE agents 
SET ai_model_2d = 'dall-e-3', 
    ai_model_3d = 'meshy-4' 
WHERE type = 'artist' AND dimension = '3d';

-- 对于非美术类型，复制到ai_model_2d（向后兼容）
UPDATE agents 
SET ai_model_2d = ai_model 
WHERE type != 'artist' AND ai_model IS NOT NULL;

-- 3. 删除旧的ai_model字段（保留一段时间用于回滚，生产环境建议谨慎）
-- ALTER TABLE agents DROP COLUMN ai_model;

-- 验证结果
SELECT 
  id, name, type, dimension, 
  ai_model as old_model, 
  ai_model_2d, 
  ai_model_3d,
  specialization
FROM agents 
WHERE type = 'artist'
ORDER BY created_at DESC 
LIMIT 10;
