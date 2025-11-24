# 🚀 Game Factory 快速参考

## 📁 项目结构

```
game-factory/
├── backend/              # TypeScript后端 (Express + MySQL)
├── frontend/             # React前端 (Vite + Ant Design)
├── database/             # 数据库初始化脚本
├── docs/                 # 详细文档
├── README.md             # 项目总览
├── DEPLOYMENT.md         # 部署指南
└── CONVERSATIONAL_IMPLEMENTATION.md  # 对话功能文档

game-factory-be/          # Go后端 (Gin + GORM)
└── 与TypeScript后端功能同步
```

## ⚡ 快速启动

### 后端 (二选一)

**TypeScript版本:**
```powershell
cd backend
npm install
npm run dev  # http://localhost:3000
```

**Go版本:**
```powershell
cd game-factory-be
go run cmd/api/main.go  # http://localhost:8080
```

### 前端

```powershell
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### 数据库初始化

```powershell
cd database
# Windows: 运行 init-db.bat
# 或手动导入: mysql -u root -p game_factory < complete-schema.sql
```

## 🔑 必需配置

### backend/.env
```env
DB_HOST=localhost
DB_NAME=game_factory
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key

# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
```

### frontend/.env.local
```env
VITE_API_URL=http://localhost:3000/api
```

## 🎯 核心功能

1. **公司管理** - 创建游戏开发公司，配置工作流
2. **员工管理** - 雇佣AI员工（策划/美术/技术/测试/音乐）
3. **项目开发** - 多阶段工作流执行
4. **对话创建** - 自然语言创建公司/员工（流式输出）
5. **市场交易** - 员工买卖
6. **社区互动** - 作品分享

## 📚 重要文档

- **[README.md](README.md)** - 完整功能介绍
- **[CONVERSATIONAL_IMPLEMENTATION.md](CONVERSATIONAL_IMPLEMENTATION.md)** - 对话功能详解
- **[docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)** - 数据库配置
- **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** - 环境变量说明
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 生产部署

## 🐛 常见问题

**Q: 前端无法连接后端?**  
A: 检查 `frontend/.env.local` 中的 `VITE_API_URL` 配置

**Q: AI功能不工作?**  
A: 确保配置了正确的API Key (OPENAI_API_KEY等)

**Q: 数据库连接失败?**  
A: 检查MySQL服务是否启动，`.env`中的数据库配置是否正确

**Q: 对话创建没有流式输出?**  
A: 浏览器DevTools → Network → 查找EventStream类型请求

## 🔗 相关链接

- TypeScript Backend: http://localhost:3000
- Go Backend: http://localhost:8080  
- Frontend: http://localhost:5173
- API Docs: http://localhost:3000/api-docs (如已配置)

---

**最后更新**: 2025-11-24  
**版本**: 2.0 (完整对话功能实现)
