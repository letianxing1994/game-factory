# 数据库迁移指南

## 方式一：使用自动脚本（推荐）

### Windows

```powershell
# 1. 进入 database 目录
cd E:\NodeProject\game-factory\database

# 2. 编辑 rebuild-db.bat，修改这些变量：
# - CONTAINER_NAME: 你的 MySQL 容器名
# - DB_PASSWORD: 你的 MySQL root 密码

# 3. 运行脚本
.\rebuild-db.bat
```

### Linux/Mac

```bash
# 1. 进入 database 目录
cd /path/to/game-factory/database

# 2. 给脚本执行权限
chmod +x rebuild-db.sh

# 3. 编辑 rebuild-db.sh，修改这些变量：
# - CONTAINER_NAME: 你的 MySQL 容器名
# - DB_PASSWORD: 你的 MySQL root 密码

# 4. 运行脚本
./rebuild-db.sh
```

---

## 方式二：手动执行命令

### 步骤 1: 查看你的容器名

```bash
docker ps -a | grep mysql
# 输出示例：
# abc123def456   mysql:8.0   "docker-entrypoint.s…"   game-factory-mysql
```

记下容器名，例如：`game-factory-mysql`

### 步骤 2: 备份现有数据（可选但推荐）

```bash
# 备份到本地文件
docker exec game-factory-mysql mysqldump -uroot -p游戏币余额 game_factory > backup_$(date +%Y%m%d).sql

# 输入密码后，备份文件会保存到当前目录
```

### 步骤 3: 删除旧数据库

```bash
docker exec -it game-factory-mysql mysql -uroot -p
# 输入密码后，进入 MySQL 命令行

# 在 MySQL 命令行中执行：
DROP DATABASE IF EXISTS game_factory;
exit;
```

### 步骤 4: 创建新数据库

```bash
docker exec -it game-factory-mysql mysql -uroot -p
# 输入密码后，执行：

CREATE DATABASE game_factory DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 步骤 5: 导入新的 schema.sql

```bash
# 进入 database 目录
cd E:\NodeProject\game-factory\database

# Windows PowerShell:
Get-Content schema.sql | docker exec -i game-factory-mysql mysql -uroot -p你的密码 game_factory

# Linux/Mac:
docker exec -i game-factory-mysql mysql -uroot -p你的密码 game_factory < schema.sql
```

### 步骤 6: 验证表结构

```bash
docker exec -it game-factory-mysql mysql -uroot -p游戏币余额 game_factory

# 在 MySQL 中执行：
SHOW TABLES;

# 检查 agents 表是否有新的 dimension 字段
DESCRIBE agents;

# 应该能看到：
# | dimension | varchar(10) | YES  |     | NULL    | 维度：2d或3d（仅美术类型需要） |
```

---

## 方式三：仅添加 dimension 字段（不删除现有数据）

如果你想保留现有数据，只添加新字段：

```bash
docker exec -it game-factory-mysql mysql -uroot -p
# 输入密码后执行：

USE game_factory;

ALTER TABLE agents 
ADD COLUMN dimension VARCHAR(10) 
COMMENT '维度：2d或3d（仅美术类型需要）' 
AFTER type;

# 验证
DESCRIBE agents;

exit;
```

---

## 常见问题排查

### 问题 1: 找不到容器

```bash
# 列出所有容器
docker ps -a

# 如果容器未运行，启动它
docker start game-factory-mysql

# 或使用 docker-compose
cd E:\NodeProject\game-factory
docker-compose up -d mysql
```

### 问题 2: 密码错误

```bash
# 检查 docker-compose.yml 中的密码配置
# 或查看容器环境变量
docker inspect game-factory-mysql | grep MYSQL_ROOT_PASSWORD
```

### 问题 3: 导入失败

```bash
# 检查 schema.sql 文件是否存在
ls -l schema.sql

# 检查文件编码（应该是 UTF-8）
file -i schema.sql

# Windows 下可能需要转换编码
# 使用 Notepad++ 或 VS Code 转换为 UTF-8
```

### 问题 4: 权限不足

```bash
# Linux/Mac 下给脚本执行权限
chmod +x rebuild-db.sh

# 如果 Docker 需要 sudo
sudo docker exec -it ...
```

---

## 验证新字段

成功导入后，应该能看到：

```sql
mysql> DESCRIBE agents;
+-------------------+----------------+------+-----+---------+----------------+
| Field             | Type           | Null | Key | Default | Extra          |
+-------------------+----------------+------+-----+---------+----------------+
| id                | bigint         | NO   | PRI | NULL    | auto_increment |
| name              | varchar(100)   | NO   |     | NULL    |                |
| type              | varchar(20)    | NO   | MUL | NULL    |                |
| dimension         | varchar(10)    | YES  |     | NULL    |                | <-- 新字段
| owner_id          | bigint         | NO   | MUL | NULL    |                |
| ...               | ...            | ...  | ... | ...     | ...            |
+-------------------+----------------+------+-----+---------+----------------+
```

创建一个测试 3D 美术 Agent：

```sql
INSERT INTO agents (name, type, dimension, owner_id, ai_model) 
VALUES ('测试3D美术师', 'artist', '3d', 1, 'meshy-4');

SELECT id, name, type, dimension, ai_model FROM agents WHERE type = 'artist';
```
