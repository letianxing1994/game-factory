@echo off
REM ========================================
REM 游戏工厂数据库一键初始化脚本
REM 包含完整表结构 + 双模型支持 + 默认配置
REM ========================================

echo.
echo ================================================
echo   游戏工厂数据库一键初始化
echo ================================================
echo.

set CONTAINER_NAME=mysql
set DB_NAME=mydb
set DB_USER=root
set DB_PASSWORD=4215628@Tim
set SCHEMA_FILE=complete-schema.sql

echo [1/4] 检查 Docker 容器...
docker ps | findstr %CONTAINER_NAME% >nul
if %errorlevel% neq 0 (
    echo [错误] MySQL 容器未运行
    echo 请先启动: docker-compose up -d mysql
    pause
    exit /b 1
)
echo    ✓ 容器运行正常

echo.
echo [2/4] 检查数据库...
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "SELECT 1 FROM mydb.users LIMIT 1;" >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠ 数据库已存在数据
    echo.
    choice /C YN /M "是否继续（会添加缺失的字段但不会删除现有数据）"
    if errorlevel 2 (
        echo 操作已取消
        pause
        exit /b 0
    )
) else (
    echo    ✓ 准备初始化数据库
)

echo.
echo [3/4] 执行 complete-schema.sql...
echo    - 创建所有表（如果不存在）
echo    - 添加双模型字段（ai_model_2d, ai_model_3d）
echo    - 插入默认系统配置
echo    - 迁移现有数据

type %SCHEMA_FILE% | docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" --default-character-set=utf8mb4 %DB_NAME% 2>nul
if %errorlevel% neq 0 (
    echo [错误] 脚本执行失败
    pause
    exit /b 1
)
echo    ✓ 脚本执行成功

echo.
echo [4/4] 验证数据库结构...
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% -e "SHOW TABLES;" 2>nul
echo.
echo agents 表字段验证:
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% -e "SHOW COLUMNS FROM agents WHERE Field LIKE 'ai_model%%';" 2>nul

echo.
echo ================================================
echo   ✅ 数据库初始化完成！
echo ================================================
echo.
echo 📊 数据库信息:
echo    - 数据库名: %DB_NAME%
echo    - 容器: %CONTAINER_NAME%
echo    - 字符集: utf8mb4
echo.
echo 🎯 下一步:
echo    1. 启动后端: cd backend ^&^& npm run dev
echo    2. 启动前端: cd frontend ^&^& npm run dev
echo.

pause
