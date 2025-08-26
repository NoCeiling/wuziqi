@echo off
chcp 65001 >nul
echo.
echo 🎮 开始部署五子棋游戏到 Vercel...
echo.

REM 检查是否安装了 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查是否安装了 Vercel CLI
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI 未安装，正在安装...
    npm install -g vercel
)

REM 检查是否已登录
echo 🔐 检查 Vercel 登录状态...
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 📝 请登录 Vercel...
    vercel login
)

REM 安装依赖
echo 📦 安装依赖...
npm install
if errorlevel 1 (
    echo ❌ 安装依赖失败
    pause
    exit /b 1
)

REM 构建项目
echo 🔨 构建项目...
npm run build
if errorlevel 1 (
    echo ❌ 构建失败，请检查代码
    pause
    exit /b 1
)

echo ✅ 构建成功！

REM 部署到 Vercel
echo 🚀 部署到 Vercel...
vercel --prod

if errorlevel 1 (
    echo ❌ 部署失败，请检查配置
    pause
    exit /b 1
) else (
    echo.
    echo 🎉 部署成功！
    echo 📱 你的五子棋游戏已上线！
    echo 🔗 访问链接已在上方显示
    echo.
    echo ✨ 部署完成！开始享受在线五子棋游戏吧！
)

echo.
echo 按任意键退出...
pause >nul