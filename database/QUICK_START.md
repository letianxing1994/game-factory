# Agents表迁移快速指南

## 一键迁移（推荐）

### Windows
```powershell
cd E:\NodeProject\game-factory\database
.\migrate-agents.bat
```

### Linux/Mac
```bash
cd /path/to/game-factory/database
chmod +x migrate-agents.sh
./migrate-agents.sh
```

## 验证迁移结果

```powershell
# Windows
.\verify-migration.bat
```

## 迁移内容

### 删除的冗余字段（9个）
- `education` - 已用ai_model替代
- `skills` - 已用specialization和extra_traits替代
- `experience_level` - 无实际作用
- `efficiency_score` - 无实际作用
- `creativity_score` - 无实际作用
- `teamwork_score` - 无实际作用
- `salary_cost` - 暂不实现经济系统
- `is_on_market` - 暂不实现市场交易
- `market_price` - 暂不实现市场交易

### 新增字段
- `extra_traits` TEXT - 额外特点，影响AI提示词

### 更新的字段注释
- `ai_model` - 明确为AI模型选择（DeepSeek-R1, GPT-5等）
- `specialization` - 明确为专业方向（游戏品类/画风/技术方向）
- `type` - 更新为包含music类型
- `status` - 简化为employed/available

## 特性

✅ 自动备份数据  
✅ 失败自动回滚提示  
✅ 显示详细迁移进度  
✅ 验证迁移结果  

## 注意事项

1. 确保Docker容器正在运行
2. 迁移会自动创建备份文件 `backup_agents_YYYYMMDD_HHMMSS.sql`
3. 如果失败，可使用备份文件恢复
4. 迁移过程保留所有现有数据

## 回滚方法

如果需要回滚：
```bash
# 使用备份文件恢复
docker exec -i mysql mysql -uroot -p"4215628@Tim" mydb < backup_agents_YYYYMMDD_HHMMSS.sql
```

## 详细文档

完整迁移说明请查看：[AGENTS_MIGRATION_GUIDE.md](./AGENTS_MIGRATION_GUIDE.md)
