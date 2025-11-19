@echo off
REM ========================================
REM Docker MySQL 数据库重建脚本 (Windows)
REM ========================================

echo.
echo ====================================
echo  Docker MySQL 数据库重建工具
echo ====================================
echo.

REM 配置变量
set CONTAINER_NAME=mysql
set DB_NAME=mydb
set DB_USER=root
set DB_PASSWORD=4215628@Tim
set SCHEMA_FILE=schema.sql

echo [1/5] 检查 Docker 容器状态...
docker ps -a | findstr %CONTAINER_NAME% >nul
if %errorlevel% neq 0 (
    echo [错误] 找不到容器 %CONTAINER_NAME%
    echo 请先启动 Docker Compose: docker-compose up -d
    pause
    exit /b 1
)

echo [2/5] 备份现有数据库 (可选)...
set BACKUP_FILE=backup_%DB_NAME%_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%
docker exec -i %CONTAINER_NAME% mysqldump -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% > %BACKUP_FILE% 2>nul
if %errorlevel% equ 0 (
    echo    备份已保存到: %BACKUP_FILE%
) else (
    echo    跳过备份 (数据库可能不存在)
)

echo [3/5] 删除现有数据库...
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "DROP DATABASE IF EXISTS %DB_NAME%;"
if %errorlevel% neq 0 (
    echo [错误] 删除数据库失败
    echo 提示: 请检查容器名称、数据库用户名和密码是否正确
    pause
    exit /b 1
)
echo    数据库已删除

echo [4/5] 创建新数据库...
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "CREATE DATABASE %DB_NAME% DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if %errorlevel% neq 0 (
    echo [错误] 创建数据库失败
    pause
    exit /b 1
)
echo    数据库已创建

echo [5/5] 导入新的 schema.sql...
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% < %SCHEMA_FILE%
if %errorlevel% neq 0 (
    echo [错误] 导入 schema 失败
    pause
    exit /b 1
)
echo    Schema 导入成功

echo.
echo ====================================
echo  数据库重建完成！
echo ====================================
echo.
echo 验证表结构:
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% -e "SHOW TABLES;"
echo.

echo 检查 agents 表结构 (确认 dimension 字段):
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% -e "DESCRIBE agents;"
echo.

pause
