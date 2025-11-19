# 📊 数据库管理

game-factory数据库管理文档和脚本。

---

## 🚀 快速开始

### 初始化数据库

```bash
# 方法1: 使用Docker Compose（推荐）
docker-compose up -d mysql

# 方法2: 手动导入
docker exec -i mysql mysql -uroot -p4215628@Tim mydb < schema.sql
```

### 双模型迁移（3D美术支持）

如果你的系统早于v1.3.0，需要执行此迁移添加ai_model_2d和ai_model_3d字段：

```powershell
# Windows
.\migrate-dual-models.bat

# 验证
docker exec mysql mysql -uroot -p4215628@Tim -e "DESCRIBE mydb.agents" | findstr ai_model
```

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `schema.sql` | 完整数据库初始化SQL，包含所有表结构 |
| `add-dual-models.sql` | 3D美术双模型迁移SQL（v1.3.0+） |
| `migrate-dual-models.bat` | Windows迁移脚本（自动备份+执行） |
| `rebuild-db.bat` | 完整重建数据库（危险操作） |

---

## 🗄️ 核心表结构

### users - 用户表
```sql
id, username, email, password_hash, avatar, reputation, 
game_coin_balance, created_at, updated_at
```

### companies - 公司表
```sql
id, name, description, owner_id, max_employees, 
workflow_type, initial_capital, current_capital, 
status, created_at, updated_at
```

### agents - Agent员工表
```sql
id, name, type, dimension, 
ai_model,        -- 非美术类型或向后兼容
ai_model_2d,     -- 美术类型2D模型（贴图/原画）
ai_model_3d,     -- 美术类型3D模型（仅3D美术）
specialization,  -- 专业方向（游戏品类/画风/技术方向）
extra_traits,    -- 额外特点（影响提示词）
owner_id, company_id, status,
created_at, updated_at
```

#### Agent类型与字段说明

| type | dimension | ai_model/ai_model_2d | ai_model_3d | specialization 示例 |
|------|-----------|---------------------|-------------|-------------------|
| planner | - | deepseek-r1, gpt-5 | - | rpg, moba, slg |
| artist | 2d | dall-e-3, midjourney | - | realistic, cartoon, anime |
| artist | 3d | dall-e-3 (贴图) | meshy-4 (模型) | realistic, cartoon |
| developer | - | gpt-5, claude | - | singleplayer, multiplayer |
| tester | - | claude, gpt-4o | - | functional, performance |
| music | - | gpt-4o, claude | - | orchestral, electronic |

### workflows - 工作流表
```sql
id, company_id, game_id, workflow_template, 
current_stage, status, started_at, completed_at
```

### workflow_stages - 工作流阶段表
```sql
id, workflow_id, stage_id, stage_name, agent_id,
status, started_at, completed_at, artifacts
```

---

## 🔄 迁移历史

### v1.3.0 - 双模型支持
**日期**: 2025-11-20  
**变更**:
- 添加 `ai_model_2d` VARCHAR(50) - 2D模型（贴图/原画）
- 添加 `ai_model_3d` VARCHAR(50) - 3D模型（3D资产生成）
- 数据迁移：
  - 2D美术: ai_model → ai_model_2d
  - 3D美术: ai_model_2d='dall-e-3', ai_model_3d='meshy-4'
  - 其他类型: 保持ai_model不变

**执行**:
```bash
.\migrate-dual-models.bat
```

### v1.2.0 - Agent表重构
**日期**: 2025-11-19  
**变更**:
- 移除9个冗余字段: skills, education, experience_level, *_score, salary_cost, is_on_market, market_price
- 添加 `extra_traits` TEXT - 用户自定义特点
- 更新字段注释，明确ai_model和specialization含义

---

## 🛠️ 常用操作

### 查看Agent列表
```sql
SELECT id, name, type, dimension, ai_model, ai_model_2d, ai_model_3d, 
       specialization, status 
FROM agents 
WHERE owner_id = 1;
```

### 查看3D美术Agent的双模型配置
```sql
SELECT name, ai_model_2d AS '2D模型', ai_model_3d AS '3D模型', 
       specialization AS '画风'
FROM agents 
WHERE type = 'artist' AND dimension = '3d';
```

### 备份数据库
```bash
docker exec mysql mysqldump -uroot -p4215628@Tim mydb > backup_$(date +%Y%m%d).sql
```

### 恢复数据库
```bash
docker exec -i mysql mysql -uroot -p4215628@Tim mydb < backup_20251120.sql
```

---

## ⚠️ 注意事项

1. **备份**: 执行任何迁移前自动备份，备份文件在当前目录
2. **测试环境**: 建议先在测试环境验证迁移脚本
3. **缓存清除**: 迁移后后端会自动清除Redis缓存
4. **字段兼容**: ai_model字段保留用于向后兼容

---

## 🔍 故障排查

### 迁移失败
```bash
# 检查备份文件
ls backup_*.sql

# 查看MySQL日志
docker logs mysql

# 手动回滚
docker exec -i mysql mysql -uroot -p4215628@Tim mydb < backup_agents_dual_models.sql
```

### 数据不一致
```bash
# 验证表结构
docker exec mysql mysql -uroot -p4215628@Tim -e "DESCRIBE mydb.agents"

# 检查数据
docker exec mysql mysql -uroot -p4215628@Tim -e "SELECT * FROM mydb.agents LIMIT 5"
```

---

## 📚 参考文档

- [完整配置文档](../docs/CONFIGURATION.md)
- [数据库设置指南](../docs/DATABASE_SETUP.md)
