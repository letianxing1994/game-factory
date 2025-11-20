# 📊 数据库管理

game-factory数据库管理文档和脚本。

---

## 🚀 快速开始

### 一键初始化数据库（推荐）

```powershell
# Windows一键初始化
.\init-db.bat
```

此脚本会自动：
1. 检查Docker容器状态
2. 备份现有数据库
3. 导入完整数据库结构
4. 插入默认配置数据
5. 验证表结构

### 手动初始化

```bash
# 方法1: 使用Docker Compose
docker-compose up -d mysql

# 方法2: 手动导入完整结构
docker exec -i mysql mysql -uroot -p4215628@Tim mydb < complete-schema.sql
```

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `complete-schema.sql` | **最终版本** - 完整数据库结构 + 双模型支持 + 默认数据 |
| `init-db.bat` | **推荐使用** - Windows一键初始化脚本（自动备份+导入+验证） |
| `README.md` | 本文档 - 数据库使用说明 |

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

## 🗄️ 数据库特性

### 版本: v1.3.0+ (2025-11-20)

**核心功能**:
- ✅ 11张核心业务表（用户、公司、Agent、游戏等）
- ✅ 双模型支持（3D美术Agent支持ai_model_2d + ai_model_3d）
- ✅ 完整的工作流系统（workflow + workflow_stages）
- ✅ 社区系统（posts + comments）
- ✅ 市场交易系统（market_transactions）
- ✅ 游戏币经济系统（coin_transactions）

**主要表**:
- `users` - 用户基础信息
- `companies` - 游戏公司
- `agents` - AI员工（支持双模型）
- `games` - 游戏项目
- `game_development_teams` - 游戏开发团队
- `workflows` - 游戏开发工作流
- `workflow_stages` - 工作流阶段
- `coin_transactions` - 游戏币交易
- `market_transactions` - 市场交易
- `community_posts` - 社区帖子
- `community_comments` - 社区评论
- `system_configs` - 系统配置

---

## 🛠️ 常用操作

### 查看所有表
```bash
docker exec mysql mysql -uroot -p4215628@Tim -e "SHOW TABLES FROM mydb"
```

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
```powershell
docker exec mysql mysqldump -uroot -p4215628@Tim mydb > backup_20251120.sql
```

### 恢复数据库
```powershell
docker exec -i mysql mysql -uroot -p4215628@Tim mydb < backup_20251120.sql
```

---

## ⚠️ 注意事项

1. **Docker卷**: 数据存储在Docker命名卷 `game-factory_mysql_volume` 中
2. **备份**: init-db.bat会在导入前自动备份现有数据
3. **默认数据**: complete-schema.sql包含6条系统配置默认数据
4. **字符集**: 所有表使用utf8mb4编码，支持emoji和多语言

---

## 🔍 故障排查

### 容器未启动
```powershell
docker-compose up -d mysql
docker ps | findstr mysql
```

### 查看MySQL日志
```powershell
docker logs mysql
```

### 验证表结构
```powershell
docker exec mysql mysql -uroot -p4215628@Tim -e "DESCRIBE mydb.agents"
```

### 检查数据
```powershell
docker exec mysql mysql -uroot -p4215628@Tim -e "SELECT COUNT(*) as total FROM mydb.games"
```

---

## 📚 相关文档

- [项目配置文档](../docs/CONFIGURATION.md)
- [数据库详细设置](../docs/DATABASE_SETUP.md)
- [Docker Compose配置](../docker-compose.yml)
