@echo off
REM ========================================
REM Agents表结构迁移脚本 (Windows)
REM 从旧结构迁移到新的简化结构
REM ========================================

echo.
echo ====================================
echo  Agents表结构迁移工具
echo ====================================
echo.

REM 配置变量（与rebuild-db.bat保持一致）
set CONTAINER_NAME=mysql
set DB_NAME=mydb
set DB_USER=root
set DB_PASSWORD=4215628@Tim

echo [1/4] 检查 Docker 容器状态...
docker ps | findstr %CONTAINER_NAME% >nul
if %errorlevel% neq 0 (
    echo [错误] 容器 %CONTAINER_NAME% 未运行
    echo 请先启动 Docker: docker-compose up -d
    pause
    exit /b 1
)

echo [2/4] 备份agents表数据...
set BACKUP_FILE=backup_agents_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%
docker exec %CONTAINER_NAME% mysqldump -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% agents > %BACKUP_FILE%
if %errorlevel% neq 0 (
    echo [错误] 备份失败！
    pause
    exit /b 1
)
echo [成功] 已备份到: %BACKUP_FILE%

echo [3/4] 执行agents表结构迁移...
echo.
echo 正在执行以下操作:
echo   - 删除冗余字段: education, skills, experience_level
echo   - 删除冗余字段: efficiency_score, creativity_score, teamwork_score
echo   - 删除冗余字段: salary_cost, is_on_market, market_price
echo   - 添加新字段: extra_traits TEXT
echo   - 更新字段注释，明确实际用途
echo.

REM 执行迁移SQL
docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% < alter-agents-table.sql
if %errorlevel% neq 0 (
    echo.
    echo [错误] 迁移失败！
    echo 可以使用备份文件恢复: %BACKUP_FILE%
    echo 恢复命令: docker exec -i %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" %DB_NAME% ^< %BACKUP_FILE%
    pause
    exit /b 1
)

echo [4/4] 验证迁移结果...
echo.
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; DESCRIBE agents;"
if %errorlevel% neq 0 (
    echo [警告] 无法显示表结构
)

echo.
echo ====================================
echo  迁移完成！
echo ====================================
echo.
echo 备份文件: %BACKUP_FILE%
echo.
echo 新的agents表结构:
echo   ✓ 保留字段: id, name, type, dimension, owner_id, company_id
echo   ✓ 保留字段: ai_model, specialization, status
echo   ✓ 新增字段: extra_traits (影响提示词)
echo   ✓ 已删除: 9个冗余字段
echo.
echo 请查看 AGENTS_MIGRATION_GUIDE.md 了解详细变更
echo.
pause
