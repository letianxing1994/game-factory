# Game Factory 前端启动脚本
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "启动 Game Factory 前端服务" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\frontend"

# 检查 .env.local 文件
if (-not (Test-Path ".env.local")) {
    Write-Host "警告: .env.local 文件不存在，使用默认配置" -ForegroundColor Yellow
}

# 检查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    npm install
}

# 启动开发服务器
Write-Host "启动前端开发服务器 (端口 5173)..." -ForegroundColor Green
npm run dev

