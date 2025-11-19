#!/bin/bash
# ========================================
# Agents表结构迁移脚本 (Linux/Mac)
# 从旧结构迁移到新的简化结构
# ========================================

echo ""
echo "===================================="
echo "  Agents表结构迁移工具"
echo "===================================="
echo ""

# 配置变量（与rebuild-db.sh保持一致）
CONTAINER_NAME="mysql"
DB_NAME="mydb"
DB_USER="root"
DB_PASSWORD="4215628@Tim"

echo "[1/4] 检查 Docker 容器状态..."
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "[错误] 容器 $CONTAINER_NAME 未运行"
    echo "请先启动 Docker: docker-compose up -d"
    exit 1
fi

echo "[2/4] 备份agents表数据..."
BACKUP_FILE="backup_agents_$(date +%Y%m%d_%H%M%S).sql"
docker exec $CONTAINER_NAME mysqldump -u$DB_USER -p"$DB_PASSWORD" $DB_NAME agents > "$BACKUP_FILE"
if [ $? -ne 0 ]; then
    echo "[错误] 备份失败！"
    exit 1
fi
echo "[成功] 已备份到: $BACKUP_FILE"

echo "[3/4] 执行agents表结构迁移..."
echo ""
echo "正在执行以下操作:"
echo "  - 删除冗余字段: education, skills, experience_level"
echo "  - 删除冗余字段: efficiency_score, creativity_score, teamwork_score"
echo "  - 删除冗余字段: salary_cost, is_on_market, market_price"
echo "  - 添加新字段: extra_traits TEXT"
echo "  - 更新字段注释，明确实际用途"
echo ""

# 执行迁移SQL
docker exec -i $CONTAINER_NAME mysql -u$DB_USER -p"$DB_PASSWORD" $DB_NAME < alter-agents-table.sql
if [ $? -ne 0 ]; then
    echo ""
    echo "[错误] 迁移失败！"
    echo "可以使用备份文件恢复: $BACKUP_FILE"
    echo "恢复命令: docker exec -i $CONTAINER_NAME mysql -u$DB_USER -p\"$DB_PASSWORD\" $DB_NAME < $BACKUP_FILE"
    exit 1
fi

echo "[4/4] 验证迁移结果..."
echo ""
docker exec $CONTAINER_NAME mysql -u$DB_USER -p"$DB_PASSWORD" -e "USE $DB_NAME; DESCRIBE agents;"
if [ $? -ne 0 ]; then
    echo "[警告] 无法显示表结构"
fi

echo ""
echo "===================================="
echo "  迁移完成！"
echo "===================================="
echo ""
echo "备份文件: $BACKUP_FILE"
echo ""
echo "新的agents表结构:"
echo "  ✓ 保留字段: id, name, type, dimension, owner_id, company_id"
echo "  ✓ 保留字段: ai_model, specialization, status"
echo "  ✓ 新增字段: extra_traits (影响提示词)"
echo "  ✓ 已删除: 9个冗余字段"
echo ""
echo "请查看 AGENTS_MIGRATION_GUIDE.md 了解详细变更"
echo ""
