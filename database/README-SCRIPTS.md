# 数据库管理脚本说明

## 📁 脚本文件

### ✅ 推荐使用（最新）

| 文件 | 说明 | 使用场景 |
|------|------|----------|
| **`complete-schema.sql`** | 🎯 完整数据库架构（推荐） | 包含所有表 + 双模型支持 + 默认数据 |
| **`init-db.bat`** | 🚀 一键初始化脚本 | 自动执行 complete-schema.sql，最方便 |

### 📦 其他文件

| 文件 | 说明 |
|------|------|
| `schema.sql` | 原始基础架构（已过时，缺少双模型字段） |
| `add-dual-models.sql` | 单独的双模型迁移脚本 |
| `migrate-dual-models.bat` | 执行双模型迁移 |
| `rebuild-db.bat` | 完全重建数据库（危险操作） |

---

## 🚀 快速开始

### 方法一：一键初始化（推荐）

```powershell
cd E:\NodeProject\game-factory\database
.\init-db.bat
```

这个脚本会：
- ✅ 检查 Docker 容器状态
- ✅ 创建所有必要的表
- ✅ 添加双模型字段（ai_model_2d, ai_model_3d）
- ✅ 插入默认系统配置
- ✅ 自动迁移现有数据
- ✅ 验证数据库结构

### 方法二：手动执行

```powershell
# 方式 1: 使用 PowerShell
cd E:\NodeProject\game-factory
Get-Content database\complete-schema.sql -Encoding UTF8 | docker exec -i mysql mysql -uroot -p"4215628@Tim" --default-character-set=utf8mb4 mydb

# 方式 2: 使用 Docker 直接导入
docker exec -i mysql mysql -uroot -p"4215628@Tim" --default-character-set=utf8mb4 mydb < database/complete-schema.sql
```

---

## 📊 数据库架构说明

### 核心表结构

```
users                    - 用户表
├── coin_transactions    - 游戏币交易记录
├── companies            - 公司表
│   ├── company_partners - 公司合伙人
│   ├── agents           - 员工Agent（⭐含双模型支持）
│   └── games            - 游戏项目
│       └── game_development_teams - 开发团队
├── market_transactions  - 市场交易
├── community_posts      - 社区帖子
│   └── community_comments - 评论
└── system_configs       - 系统配置
```

### agents 表重点字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `ai_model` | VARCHAR(50) | 旧字段（兼容保留） |
| `ai_model_2d` | VARCHAR(50) | **新增** 2D模型（DALL-E-3等） |
| `ai_model_3d` | VARCHAR(50) | **新增** 3D模型（Meshy-4等） |
| `dimension` | VARCHAR(10) | 维度标识：2d/3d |
| `type` | VARCHAR(20) | 类型：artist, planner, developer等 |

---

## 🔧 常见操作

### 检查数据库状态

```powershell
# 查看所有表
docker exec mysql mysql -uroot -p"4215628@Tim" -e "SHOW TABLES FROM mydb;"

# 查看 agents 表结构
docker exec mysql mysql -uroot -p"4215628@Tim" -e "DESCRIBE mydb.agents;"

# 验证双模型字段
docker exec mysql mysql -uroot -p"4215628@Tim" mydb -e "SELECT id, name, type, dimension, ai_model, ai_model_2d, ai_model_3d FROM agents LIMIT 5;"
```

### 备份数据库

```powershell
# 备份整个数据库
docker exec mysql mysqldump -uroot -p"4215628@Tim" mydb > backup_mydb_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# 只备份结构
docker exec mysql mysqldump -uroot -p"4215628@Tim" --no-data mydb > schema_backup.sql
```

### 重置数据库（危险操作）

```powershell
# 删除并重建
docker exec mysql mysql -uroot -p"4215628@Tim" -e "DROP DATABASE IF EXISTS mydb; CREATE DATABASE mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 重新导入
Get-Content database\complete-schema.sql -Encoding UTF8 | docker exec -i mysql mysql -uroot -p"4215628@Tim" --default-character-set=utf8mb4 mydb
```

---

## 🎯 版本历史

### v1.3.0+ (2025-11-20) - 当前版本
- ✅ 添加 `ai_model_2d` 和 `ai_model_3d` 字段
- ✅ 支持3D美术双模型工作流
- ✅ 创建 `complete-schema.sql` 统一脚本
- ✅ 创建 `init-db.bat` 一键初始化

### v1.2.0
- 添加 `dimension` 字段区分2D/3D美术
- 完善工作流配置

### v1.0.0
- 初始数据库架构
- 基础表结构

---

## ⚠️ 注意事项

1. **字符编码**：所有脚本必须使用 UTF-8 编码
2. **数据持久化**：确保 `docker-compose.yml` 中正确配置了数据卷挂载
3. **密码安全**：生产环境请更改默认密码
4. **备份习惯**：重要操作前先备份数据

---

## 🆘 故障排除

### 问题：导入时出现乱码

**解决方案**：
```powershell
Get-Content database\complete-schema.sql -Encoding UTF8 | docker exec -i mysql mysql -uroot -p"4215628@Tim" --default-character-set=utf8mb4 mydb
```

### 问题：数据库不存在

**解决方案**：
```powershell
docker exec mysql mysql -uroot -p"4215628@Tim" -e "CREATE DATABASE mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 问题：容器未运行

**解决方案**：
```powershell
cd E:\NodeProject\game-factory
docker-compose up -d mysql
```

---

## 📞 支持

如有问题，请检查：
1. Docker 容器是否正常运行
2. 数据卷是否正确挂载到 `./Data/mysql_data`
3. 后端 `.env` 文件中的数据库配置

完整文档：`../docs/DATABASE_SETUP.md`
