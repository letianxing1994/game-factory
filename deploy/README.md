# Deploy 目录说明

## 部署方式

本项目支持多种部署方式，具体请参考：

- **[../DEPLOYMENT.md](../DEPLOYMENT.md)** - 完整的部署指南

包含：
- 本地开发环境配置
- Docker Compose 一键部署
- 生产环境 Nginx + PM2 配置
- 数据库和 Redis 优化
- 安全加固建议

## 注意事项

multi-node 目录已删除，因为：
1. 原有脚本为占位符模板，无法直接使用
2. 完整的分布式部署配置已整合到 DEPLOYMENT.md
3. Docker Compose 配置更加实用和易于维护

如需多节点部署，请参考 DEPLOYMENT.md 中的"生产环境部署"章节。
