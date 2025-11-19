# 📝 更新日志 (CHANGELOG)

本文档记录game-factory项目的主要功能变更和更新历史。

---

## [v1.3.0] - 2025-11-20

### ✨ 新增功能
- **3D美术双模型支持**
  - 添加`ai_model_2d`字段用于贴图/原画生成（DALL-E-3, Midjourney等）
  - 添加`ai_model_3d`字段用于3D模型生成（Meshy-4, Luma AI等）
  - 前端UI支持分别选择两个模型
  - 表格列显示双模型信息

- **Agent删除功能**
  - 新增DELETE `/agents/:id`接口
  - 删除前确认对话框
  - 在职员工需先解雇才能删除
  - 自动清除相关缓存

- **试运行确认弹窗**
  - 点击试运行先显示确认对话框
  - 展示默认配置信息（项目名称、游戏类型、执行阶段）
  - 提示AI模型调用成本

### 🐛 Bug修复
- **修复缓存刷新问题**
  - 使用Redis通配符清除所有相关缓存键
  - 修复创建Agent后列表不刷新的问题
  - 延迟100ms刷新确保MySQL写入完成

- **简化试运行流程**
  - 移除复杂的表单填写
  - 自动使用默认配置（RPG、3D、写实风格等）
  - 自动生成项目名称

### 🔧 优化改进
- React Query配置优化：`refetchOnMount: 'always'`, `cacheTime: 0`
- 后端缓存清除逻辑统一：创建/更新/删除/解雇时清除所有匹配缓存
- 前端类型定义更新：添加`ai_model_2d`和`ai_model_3d`字段

### 📚 文档更新
- 重写主README，突出核心功能和技术架构
- 创建database/README.md，详细说明表结构和迁移历史
- 删除过期的迁移文档（AGENTS_MIGRATION_GUIDE.md等）
- 更新快速开始指南

---

## [v1.2.0] - 2025-11-19

### ✨ 新增功能
- **Agent表重构**
  - 移除9个冗余字段（skills, education, *_score, salary_cost等）
  - 添加`extra_traits`字段用于自定义特点
  - 字段语义重新定义：
    - `ai_model`: 改为AI模型选择（DeepSeek-R1, GPT-5等）
    - `specialization`: 明确为专业方向（游戏品类/画风/技术方向）

- **2D/3D美术分离**
  - 添加`dimension`字段区分2D和3D美术
  - 前端创建表单支持选择维度
  - 表格显示维度标签

### 🔧 优化改进
- 前端表单验证增强
- Agent创建流程优化
- 数据库索引优化

---

## [v1.1.0] - 2025-11-18

### ✨ 新增功能
- **公司与Agent参数分离**
  - 公司配置不再包含游戏类型等项目参数
  - 项目启动时独立填写游戏配置
  - 支持同一公司开发不同类型游戏

### 🐛 Bug修复
- 修复公司创建时的字段验证问题
- 修复工作流状态更新延迟

---

## [v1.0.0] - 2025-11-15

### ✨ 初始版本
- 用户注册与登录
- 公司创建与管理
- Agent员工创建与配置
- 基础工作流调度
- Kafka异步任务队列
- Redis缓存
- 与my-agent-test集成

---

## 迁移指南

### 从v1.2.x升级到v1.3.0

1. **停止服务**
   ```bash
   # 停止后端
   # 停止前端
   ```

2. **数据库迁移**
   ```bash
   cd database
   .\migrate-dual-models.bat  # Windows
   ```

3. **更新代码**
   ```bash
   git pull origin main
   cd backend && npm install
   cd frontend && npm install
   ```

4. **重启服务**
   ```bash
   # 启动后端
   cd backend && npm run dev
   # 启动前端
   cd frontend && npm run dev
   ```

### 从v1.1.x升级到v1.2.0

需要执行Agent表重构迁移（已包含在v1.3.0迁移中）。

---

## 已知问题

### v1.3.0
- [ ] 试运行时如果my-agent-test服务未启动，错误提示不够友好
- [ ] 3D美术双模型在workflowBuilder中的处理还需优化

---

## 即将推出

### v1.4.0 (计划中)
- [ ] Agent市场交易功能
- [ ] 经济系统（游戏币、薪资）
- [ ] Agent经验值与升级系统
- [ ] 工作流模板库
- [ ] 批量操作Agent

### v1.5.0 (计划中)
- [ ] 多人协作开发
- [ ] 项目克隆与模板
- [ ] 高级工作流编排
- [ ] 性能优化与缓存策略

---

## 贡献者

感谢所有为game-factory做出贡献的开发者！

---

## 反馈与支持

- 提交Bug: [GitHub Issues](https://github.com/letianxing1994/game-factory/issues)
- 功能建议: [GitHub Discussions](https://github.com/letianxing1994/game-factory/discussions)
