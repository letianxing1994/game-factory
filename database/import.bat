@echo off
REM Game Factory 数据库导入脚本 (Windows)
REM 使用方法: import.bat [container-name] [db-user] [db-password] [db-name]

setlocal enabledelayedexpansion

REM 默认配置
set "CONTAINER_NAME=%~1"
if "%CONTAINER_NAME%"=="" set "CONTAINER_NAME=game-factory-mysql"

set "DB_USER=%~2"
if "%DB_USER%"=="" set "DB_USER=root"

set "DB_PASSWORD=%~3"
if "%DB_PASSWORD%"=="" set "DB_PASSWORD=root"

set "DB_NAME=%~4"
if "%DB_NAME%"=="" set "DB_NAME=game_factory"

set "SQL_FILE=%~dp0schema.sql"

echo ==========================================
echo Game Factory 数据库导入工具
echo ==========================================
echo 容器名称: %CONTAINER_NAME%
echo 数据库用户: %DB_USER%
echo 数据库名称: %DB_NAME%
echo SQL 文件: %SQL_FILE%
echo ==========================================
echo.

REM 检查容器是否运行
docker ps | findstr "%CONTAINER_NAME%" >nul
if errorlevel 1 (
    echo [错误] MySQL 容器 '%CONTAINER_NAME%' 未运行
    echo.
    echo 请先启动容器，或指定正确的容器名称：
    echo   import.bat ^<container-name^> [user] [password] [database]
    echo.
    echo 查看所有容器:
    echo   docker ps -a
    exit /b 1
)

REM 检查 SQL 文件是否存在
if not exist "%SQL_FILE%" (
    echo [错误] SQL 文件 '%SQL_FILE%' 不存在
    exit /b 1
)

REM 检查数据库是否存在，如果不存在则创建
echo [信息] 检查数据库是否存在...
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p%DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1

if errorlevel 1 (
    echo [错误] 无法连接到 MySQL 或创建数据库
    echo 请检查：
    echo   1. 容器名称是否正确
    echo   2. 用户名和密码是否正确
    echo   3. MySQL 服务是否已完全启动
    exit /b 1
)

echo [成功] 数据库检查完成
echo.

REM 导入 SQL
echo [信息] 正在导入 %SQL_FILE% 到数据库 %DB_NAME%...
type "%SQL_FILE%" | docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME%

if errorlevel 1 (
    echo.
    echo [错误] 导入失败！
    echo 请检查：
    echo   1. SQL 文件语法是否正确
    echo   2. 数据库用户是否有足够权限
    echo   3. 查看容器日志: docker logs %CONTAINER_NAME%
    exit /b 1
)

echo.
echo [成功] 导入成功！
echo.
echo [信息] 验证: 查看表列表
docker exec -it %CONTAINER_NAME% mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% -e "SHOW TABLES;"
echo.
echo [完成] 数据库初始化完成！

