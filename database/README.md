# 数据库脚本说明

## 文件列表

### 核心脚本
- **schema.sql** - 完整数据库表结构定义（最新版本）
- **rebuild-db.bat** - Windows数据库重建脚本（完全重建，会丢失数据）

### 迁移脚本
- **migrate-agents.bat** - Windows Agents表结构迁移脚本（保留数据）
- **migrate-agents.sh** - Linux/Mac Agents表结构迁移脚本（保留数据）
- **alter-agents-table.sql** - Agents表ALTER语句
- **AGENTS_MIGRATION_GUIDE.md** - 详细迁移指南

### 文档
- **MIGRATION_GUIDE.md** - dimension字段迁移指南（已过期，保留供参考）

## 快速开始

### 首次设置数据库
```bash
# Windows
.\rebuild-db.bat

# Linux/Mac
./rebuild-db.sh
```

### 迁移Agents表结构（从旧版本升级）
```bash
# Windows
.\migrate-agents.bat

# Linux/Mac
chmod +x migrate-agents.sh
./migrate-agents.sh
```

## 注意事项

1. **rebuild-db.bat** 会删除并重建整个数据库，适合：
   - 首次部署
   - 开发环境重置
   - 不关心现有数据的情况

2. **migrate-agents.bat** 只修改agents表结构，保留数据，适合：
   - 生产环境升级
   - 从旧版本迁移到新版本
   - 需要保留现有员工数据

3. 所有迁移脚本都会自动创建备份，失败时可以恢复

## 数据库配置

默认配置（可在脚本中修改）：
- **容器名**: mysql
- **数据库名**: mydb
- **用户名**: root
- **密码**: 4215628@Tim

## Agents表结构变更

最新版本移除了以下冗余字段：
- `education`, `skills`, `experience_level`
- `efficiency_score`, `creativity_score`, `teamwork_score`
- `salary_cost`, `is_on_market`, `market_price`

新增字段：
- `extra_traits` TEXT - 员工额外特点，影响AI提示词

详见 [AGENTS_MIGRATION_GUIDE.md](./AGENTS_MIGRATION_GUIDE.md)
