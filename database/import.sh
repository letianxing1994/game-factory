#!/bin/bash

# Game Factory 数据库导入脚本
# 使用方法: ./import.sh [container-name] [db-user] [db-password] [db-name]

# 默认配置
CONTAINER_NAME="${1:-game-factory-mysql}"
DB_USER="${2:-root}"
DB_PASSWORD="${3:-root}"
DB_NAME="${4:-game_factory}"
SQL_FILE="$(dirname "$0")/schema.sql"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Game Factory 数据库导入工具"
echo "=========================================="
echo "容器名称: $CONTAINER_NAME"
echo "数据库用户: $DB_USER"
echo "数据库名称: $DB_NAME"
echo "SQL 文件: $SQL_FILE"
echo "=========================================="
echo ""

# 检查容器是否运行
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ 错误: MySQL 容器 '$CONTAINER_NAME' 未运行${NC}"
    echo ""
    echo "请先启动容器，或指定正确的容器名称："
    echo "  ./import.sh <container-name> [user] [password] [database]"
    echo ""
    echo "查看所有容器:"
    echo "  docker ps -a"
    exit 1
fi

# 检查 SQL 文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ 错误: SQL 文件 '$SQL_FILE' 不存在${NC}"
    exit 1
fi

# 检查数据库是否存在，如果不存在则创建
echo -e "${YELLOW}📋 检查数据库是否存在...${NC}"
docker exec "$CONTAINER_NAME" mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 无法连接到 MySQL 或创建数据库${NC}"
    echo "请检查："
    echo "  1. 容器名称是否正确"
    echo "  2. 用户名和密码是否正确"
    echo "  3. MySQL 服务是否已完全启动"
    exit 1
fi

echo -e "${GREEN}✅ 数据库检查完成${NC}"
echo ""

# 导入 SQL
echo -e "${YELLOW}📥 正在导入 $SQL_FILE 到数据库 $DB_NAME...${NC}"
docker exec -i "$CONTAINER_NAME" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 导入成功！${NC}"
    echo ""
    echo -e "${YELLOW}📊 验证: 查看表列表${NC}"
    docker exec -it "$CONTAINER_NAME" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;"
    echo ""
    echo -e "${GREEN}🎉 数据库初始化完成！${NC}"
else
    echo ""
    echo -e "${RED}❌ 导入失败！${NC}"
    echo "请检查："
    echo "  1. SQL 文件语法是否正确"
    echo "  2. 数据库用户是否有足够权限"
    echo "  3. 查看容器日志: docker logs $CONTAINER_NAME"
    exit 1
fi

