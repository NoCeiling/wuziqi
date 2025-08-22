#!/bin/bash

# 五子棋游戏 Vercel 部署脚本

echo "🎮 开始部署五子棋游戏到 Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm install -g vercel
fi

# 检查是否已登录
echo "🔐 检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "📝 请登录 Vercel..."
    vercel login
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功！"
else
    echo "❌ 构建失败，请检查代码"
    exit 1
fi

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    echo "🎉 部署成功！"
    echo "📱 你的五子棋游戏已上线！"
    echo "🔗 访问链接将在上方显示"
else
    echo "❌ 部署失败，请检查配置"
    exit 1
fi

echo "✨ 部署完成！开始享受在线五子棋游戏吧！"