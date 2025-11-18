# Game Factory 后端启动脚本
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "启动 Game Factory 后端服务" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"

# 检查 .env 文件
if (-not (Test-Path ".env")) {
    Write-Host "错误: .env 文件不存在！" -ForegroundColor Red
    Write-Host "请从 env.example 复制并配置 .env 文件" -ForegroundColor Yellow
    exit 1
}

# 检查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    npm install
}

# 编译 TypeScript
Write-Host "编译 TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "编译失败！" -ForegroundColor Red
    exit 1
}

# 启动服务
Write-Host "启动后端服务 (端口 4000)..." -ForegroundColor Green
npm start

