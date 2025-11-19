@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ====================================
echo  为3D美术Agent添加双模型支持
echo ====================================
echo.

REM 检查Docker容器
docker ps | findstr mysql >nul
if errorlevel 1 (
    echo [错误] MySQL容器未运行，请先启动Docker
    pause
    exit /b 1
)

REM 数据库连接信息
set MYSQL_HOST=localhost
set MYSQL_PORT=3306
set MYSQL_USER=root
set MYSQL_PASSWORD=4215628@Tim
set MYSQL_DATABASE=mydb

echo [1/3] 备份agents表数据...
docker exec mysql mysqldump -u%MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE% agents > backup_agents_dual_models.sql 2>nul
if errorlevel 1 (
    echo [失败] 备份失败
    pause
    exit /b 1
)
echo [成功] 已备份到: backup_agents_dual_models.sql

echo.
echo [2/3] 执行agents表结构迁移...
echo.
echo 正在执行以下操作:
echo   - 添加新字段: ai_model_2d (2D模型)
echo   - 添加新字段: ai_model_3d (3D模型)
echo   - 迁移现有数据到新字段
echo.

docker exec -i mysql mysql -u%MYSQL_USER% -p%MYSQL_PASSWORD% < add-dual-models.sql
if errorlevel 1 (
    echo.
    echo [错误] 迁移失败！
    echo.
    echo 使用备份文件恢复:
    echo docker exec -i mysql mysql -u%MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE% ^< backup_agents_dual_models_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
    pause
    exit /b 1
)

echo.
echo [3/3] 验证迁移结果...
echo.
docker exec mysql mysql -u%MYSQL_USER% -p%MYSQL_PASSWORD% -e "DESCRIBE mydb.agents;" 2>nul | findstr "ai_model"

echo.
echo ====================================
echo  迁移完成！
echo ====================================
echo.
echo 备份文件: backup_agents_dual_models_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
echo.
echo 新的agents表结构:
echo   ✓ ai_model (保留，向后兼容)
echo   ✓ ai_model_2d (2D模型 - 用于原画/贴图)
echo   ✓ ai_model_3d (3D模型 - 用于3D资产生成)
echo.
echo 3D美术Agent现在可以使用两个模型：
echo   - ai_model_2d: DALL-E-3, Midjourney (生成概念图/贴图)
echo   - ai_model_3d: Meshy-4, Luma AI (生成3D模型)
echo.
pause
