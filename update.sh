#!/bin/bash

# 项目更新脚本
# 使用方法：./update.sh

PROJECT_NAME="wuziqi"
PROJECT_DIR="/var/www/$PROJECT_NAME"

echo "🔄 更新五子棋项目..."

# 进入项目目录
cd $PROJECT_DIR

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin master

# 安装新依赖
echo "📦 安装依赖..."
npm install

# 重新构建
echo "🔨 重新构建..."
npm run build

# 重启应用
echo "🚀 重启应用..."
pm2 restart $PROJECT_NAME

echo "✅ 更新完成！"
echo "📊 应用状态:"
pm2 status