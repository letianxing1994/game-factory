# 数据库设置指南

本文档说明如何将 `database/schema.sql` 导入到 Docker 启动的 MySQL 中。

## 方法一：使用 docker exec 直接导入（推荐）

### 步骤 1：确保 MySQL 容器正在运行

```bash
# 查看运行中的容器
docker ps

# 如果 MySQL 容器未运行，启动它
docker start <mysql-container-name>
# 或者
docker-compose up -d mysql
```

### 步骤 2：导入 SQL 文件

```bash
# 方法 1：从宿主机直接导入（最简单）
docker exec -i <mysql-container-name> mysql -u<username> -p<password> <database-name> < database/schema.sql

# 示例（如果容器名为 mysql，用户名为 root，密码为 root，数据库名为 game_factory）
docker exec -i mysql mysql -uroot -proot game_factory < database/schema.sql
```

### 步骤 3：验证导入

```bash
# 连接到 MySQL 容器
docker exec -it <mysql-container-name> mysql -u<username> -p<password> <database-name>

# 在 MySQL 命令行中执行
SHOW TABLES;
USE game_factory;
SELECT COUNT(*) FROM users;
```

## 方法二：先复制文件到容器，再导入

### 步骤 1：复制 SQL 文件到容器

```bash
# 复制文件到容器
docker cp database/schema.sql <mysql-container-name>:/tmp/schema.sql
```

### 步骤 2：在容器内执行导入

```bash
# 进入容器
docker exec -it <mysql-container-name> bash

# 在容器内执行
mysql -u<username> -p<password> <database-name> < /tmp/schema.sql

# 或者使用 source 命令
mysql -u<username> -p<password> <database-name>
source /tmp/schema.sql;
```

## 方法三：使用管道导入（适合环境变量）

```bash
# 使用环境变量
docker exec -i <mysql-container-name> sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/schema.sql

# 或者直接指定
cat database/schema.sql | docker exec -i <mysql-container-name> mysql -uroot -proot game_factory
```

## 方法四：使用 docker-compose（如果使用 docker-compose）

### 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: game-factory-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: game_factory
      MYSQL_USER: game_factory_user
      MYSQL_PASSWORD: game_factory_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      # 挂载 SQL 文件到容器
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    command: --default-authentication-plugin=mysql_native_password

volumes:
  mysql_data:
```

**注意**：使用 `docker-entrypoint-initdb.d` 目录时，SQL 文件只会在**首次启动**时自动执行。如果数据库已存在，需要手动导入。

### 启动并导入

```bash
# 首次启动（会自动导入）
docker-compose up -d mysql

# 如果容器已存在，需要先删除数据卷再启动
docker-compose down -v
docker-compose up -d mysql
```

## 方法五：在容器启动时自动导入（推荐用于开发环境）

### 创建初始化脚本

创建 `database/init-db.sh`：

```bash
#!/bin/bash
set -e

echo "等待 MySQL 启动..."
until mysqladmin ping -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent; do
  sleep 1
done

echo "导入 schema.sql..."
mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < /docker-entrypoint-initdb.d/schema.sql

echo "数据库初始化完成！"
```

### 修改 docker-compose.yml

```yaml
services:
  mysql:
    image: mysql:8.0
    volumes:
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
      - ./database/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    command: --init-file=/docker-entrypoint-initdb.d/init-db.sh
```

## 完整示例：快速导入脚本

创建 `database/import.sh`：

```bash
#!/bin/bash

# 配置变量
CONTAINER_NAME="game-factory-mysql"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="game_factory"
SQL_FILE="database/schema.sql"

# 检查容器是否运行
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "错误: MySQL 容器 '$CONTAINER_NAME' 未运行"
    echo "请先启动容器: docker start $CONTAINER_NAME"
    exit 1
fi

# 检查 SQL 文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo "错误: SQL 文件 '$SQL_FILE' 不存在"
    exit 1
fi

# 导入 SQL
echo "正在导入 $SQL_FILE 到数据库 $DB_NAME..."
docker exec -i "$CONTAINER_NAME" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ 导入成功！"
    echo "验证: 查看表列表"
    docker exec -it "$CONTAINER_NAME" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;"
else
    echo "❌ 导入失败！"
    exit 1
fi
```

使用脚本：

```bash
# 添加执行权限
chmod +x database/import.sh

# 执行导入
./database/import.sh
```

## 常见问题排查

### 1. 容器名称或 ID 未知

```bash
# 查找 MySQL 容器
docker ps -a | grep mysql

# 或者列出所有容器
docker ps -a
```

### 2. 数据库不存在

```bash
# 先创建数据库
docker exec -it <mysql-container-name> mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS game_factory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. 权限问题

```bash
# 如果使用非 root 用户，确保有足够权限
docker exec -it <mysql-container-name> mysql -uroot -proot -e "GRANT ALL PRIVILEGES ON game_factory.* TO 'game_factory_user'@'%'; FLUSH PRIVILEGES;"
```

### 4. 字符编码问题

确保数据库使用 utf8mb4：

```bash
# 创建数据库时指定字符集
docker exec -it <mysql-container-name> mysql -uroot -proot -e "CREATE DATABASE game_factory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 5. 查看导入日志

```bash
# 查看容器日志
docker logs <mysql-container-name>

# 实时查看日志
docker logs -f <mysql-container-name>
```

## 验证导入结果

```bash
# 连接到数据库
docker exec -it <mysql-container-name> mysql -uroot -proot game_factory

# 在 MySQL 命令行中执行以下命令验证：

# 查看所有表
SHOW TABLES;

# 查看表结构
DESCRIBE users;
DESCRIBE companies;
DESCRIBE agents;

# 查看表数量
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'game_factory';

# 查看系统配置（schema.sql 中有默认数据）
SELECT * FROM system_configs;
```

## 快速命令参考

```bash
# 1. 查找 MySQL 容器
docker ps | grep mysql

# 2. 导入 SQL（替换容器名、用户名、密码、数据库名）
docker exec -i <container-name> mysql -u<user> -p<password> <database> < database/schema.sql

# 3. 验证导入
docker exec -it <container-name> mysql -u<user> -p<password> <database> -e "SHOW TABLES;"

# 4. 完整示例（假设容器名为 mysql，用户 root，密码 root，数据库 game_factory）
docker exec -i mysql mysql -uroot -proot game_factory < database/schema.sql
docker exec -it mysql mysql -uroot -proot game_factory -e "SHOW TABLES;"
```

## 注意事项

1. **首次导入**：如果数据库已存在数据，导入可能会失败（表已存在）。可以先删除数据库再导入，或使用 `DROP TABLE IF EXISTS`。

2. **数据备份**：导入前建议备份现有数据：
   ```bash
   docker exec <mysql-container-name> mysqldump -uroot -proot game_factory > backup.sql
   ```

3. **字符编码**：确保 SQL 文件使用 UTF-8 编码，数据库使用 utf8mb4。

4. **权限**：确保 MySQL 用户有创建表和插入数据的权限。

5. **容器状态**：确保 MySQL 容器正在运行且 MySQL 服务已完全启动（可能需要等待几秒）。

