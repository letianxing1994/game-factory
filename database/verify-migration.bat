@echo off
REM ========================================
REM 测试Agents表迁移结果
REM ========================================

echo.
echo ====================================
echo  Agents表结构验证工具
echo ====================================
echo.

REM 配置变量
set CONTAINER_NAME=mysql
set DB_NAME=mydb
set DB_USER=root
set DB_PASSWORD=4215628@Tim

echo [1/3] 检查表结构...
echo.
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; DESCRIBE agents;"

echo.
echo [2/3] 检查必需字段是否存在...
echo.

REM 检查新字段
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'extra_traits';" | findstr "extra_traits" >nul
if %errorlevel% equ 0 (
    echo [✓] extra_traits 字段存在
) else (
    echo [✗] extra_traits 字段缺失
)

REM 检查核心字段
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'ai_model';" | findstr "ai_model" >nul
if %errorlevel% equ 0 (
    echo [✓] ai_model 字段存在
) else (
    echo [✗] ai_model 字段缺失
)

docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'specialization';" | findstr "specialization" >nul
if %errorlevel% equ 0 (
    echo [✓] specialization 字段存在
) else (
    echo [✗] specialization 字段缺失
)

docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'dimension';" | findstr "dimension" >nul
if %errorlevel% equ 0 (
    echo [✓] dimension 字段存在
) else (
    echo [✗] dimension 字段缺失
)

echo.
echo [3/3] 检查旧字段是否已删除...
echo.

REM 检查应该被删除的字段
docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'education';" | findstr "education" >nul
if %errorlevel% equ 0 (
    echo [✗] education 字段仍存在（应该被删除）
) else (
    echo [✓] education 字段已删除
)

docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'skills';" | findstr "skills" >nul
if %errorlevel% equ 0 (
    echo [✗] skills 字段仍存在（应该被删除）
) else (
    echo [✓] skills 字段已删除
)

docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'salary_cost';" | findstr "salary_cost" >nul
if %errorlevel% equ 0 (
    echo [✗] salary_cost 字段仍存在（应该被删除）
) else (
    echo [✓] salary_cost 字段已删除
)

docker exec %CONTAINER_NAME% mysql -u%DB_USER% -p"%DB_PASSWORD%" -e "USE %DB_NAME%; SHOW COLUMNS FROM agents LIKE 'is_on_market';" | findstr "is_on_market" >nul
if %errorlevel% equ 0 (
    echo [✗] is_on_market 字段仍存在（应该被删除）
) else (
    echo [✓] is_on_market 字段已删除
)

echo.
echo ====================================
echo  验证完成！
echo ====================================
echo.
echo 如果所有检查都显示 [✓]，说明迁移成功
echo 如果有 [✗]，请查看 AGENTS_MIGRATION_GUIDE.md
echo.
pause
