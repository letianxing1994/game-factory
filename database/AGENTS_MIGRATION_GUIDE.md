# Agents表重构迁移指南

## 概述
本次重构简化了agents表结构，移除了冗余的游戏化字段，让字段更具实际意义：
- **ai_model**: 原"教育背景"，现表示该agent使用的AI模型
- **specialization**: 原"专业方向"，现表示游戏品类/画风/技术方向等实际专业
- **extra_traits**: 新增字段，用户自定义的特点，影响agent执行时的提示词

## 字段映射关系

### 保留字段（含义明确）
- `id`, `name`, `type`, `dimension`, `owner_id`, `company_id`
- `status`, `created_at`, `updated_at`

### 修改注释的字段（明确实际用途）
- **ai_model**: AI模型选择
  - 策划agent: DeepSeek-R1, GPT-5, Claude-Sonnet-4.5等
  - 美术agent(2D): DALL-E-3, Midjourney, Stable-Diffusion等
  - 美术agent(3D): DALL-E-3+Meshy-4（双模型）
  - 技术agent: GPT-5, Claude-Sonnet-4.5, Deepseek-Coder等
  - 测试agent: GPT-4o, Claude-Sonnet-4.5等
  - 为空时使用配置文件中的默认模型

- **specialization**: 专业方向（根据type不同含义不同）
  - planner: RPG, MOBA, SLG, Shooter, Casual等游戏品类
  - artist: realistic, cartoon, pixel, anime等画风
  - developer: singleplayer, multiplayer等技术方向
  - tester: functional, performance, security等测试方向
  - music: orchestral, electronic, ambient等音乐风格

### 新增字段
- **extra_traits**: 额外特点（TEXT类型）
  - 用户自定义的特点描述
  - 会注入到agent执行时的系统提示词中
  - 示例：
    - 技术agent: "擅长C++性能优化和内存管理"
    - 美术agent: "精通日式动漫风格和角色设计"
    - 策划agent: "擅长数值平衡和经济系统设计"

### 删除字段（冗余无实际作用）
- `education` (已被ai_model替代)
- `skills` (已被specialization和extra_traits替代)
- `experience_level` (无实际影响)
- `efficiency_score` (无实际影响)
- `creativity_score` (无实际影响)
- `teamwork_score` (无实际影响)
- `salary_cost` (暂不实现经济系统)
- `is_on_market` (暂不实现市场交易)
- `market_price` (暂不实现市场交易)

## 执行迁移

### 方式一：使用自动迁移脚本（推荐）

#### Windows
```powershell
cd E:\NodeProject\game-factory\database
.\migrate-agents.bat
```

#### Linux/Mac
```bash
cd /path/to/game-factory/database
chmod +x migrate-agents.sh
./migrate-agents.sh
```

迁移脚本会自动：
1. 检查Docker容器状态
2. 备份agents表数据
3. 执行ALTER TABLE语句
4. 验证迁移结果

### 方式二：手动执行SQL（高级用户）

#### 通过Docker执行
```bash
# Windows PowerShell
docker exec -i mysql mysql -uroot -p"4215628@Tim" mydb < alter-agents-table.sql

# Linux/Mac
docker exec -i mysql mysql -uroot -p"4215628@Tim" mydb < alter-agents-table.sql
```

#### 直连MySQL（非Docker）
```bash
mysql -h localhost -u root -p mydb < alter-agents-table.sql
```

## 数据影响
- **无数据丢失风险**: 删除的字段都是冗余字段，不影响核心业务
- **现有数据**: company_id, owner_id, type, dimension等核心字段保持不变
- **新数据**: 创建新agent时，extra_traits可为空

## 代码兼容性
需要同步修改的代码模块：
1. ✅ `game-factory/frontend/src/pages/Agents.tsx` - agent创建表单
2. ✅ `game-factory/backend/src/routes/agents.ts` - agent API路由
3. ✅ `game-factory/backend/src/services/workflowBuilder.ts` - workflow构建服务
4. ✅ `my-agent-test/src/agents/*/index.ts` - 各agent执行器（接收并使用新字段）

## 验证清单
- [ ] 执行alter-agents-table.sql
- [ ] 验证表结构：`DESCRIBE agents;`
- [ ] 创建新agent测试（前端表单正常提交）
- [ ] 启动workflow测试（agent参数正常传递）
- [ ] 检查提示词注入（extra_traits生效）
- [ ] 检查模型选择（ai_model生效）

## 回滚方案
如果迁移出现问题，可以使用schema.sql重建表：
```bash
mysql -h localhost -u root -p game_factory < schema.sql
```
**注意**: 这会丢失所有agents表数据，仅用于测试环境。
