#!/bin/bash

# 阿里云服务器全球访问部署脚本
# 优化国内外访问速度
# 使用方法：chmod +x deploy-aliyun.sh && ./deploy-aliyun.sh

echo "🌍 开始部署五子棋项目到阿里云服务器（全球访问优化版）"

# 设置变量
PROJECT_NAME="wuziqi"
PROJECT_DIR="/var/www/$PROJECT_NAME"
GITHUB_REPO="https://github.com/NoCeiling/wuziqi.git"
PORT=3000
DOMAIN="your-domain.com"  # 替换为你的域名

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用sudo运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
apt-get update && apt-get upgrade -y

# 安装Node.js
echo "📦 安装Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# 验证Node.js安装
echo "✅ Node.js版本: $(node --version)"
echo "✅ NPM版本: $(npm --version)"

# 安装PM2
echo "📦 安装PM2..."
npm install -g pm2

# 安装Git
echo "📦 安装Git..."
apt-get install -y git

# 创建项目目录
echo "📁 创建项目目录..."
mkdir -p $PROJECT_DIR

# 克隆项目
echo "📥 克隆项目代码..."
if [ -d "$PROJECT_DIR/.git" ]; then
    cd $PROJECT_DIR
    git pull origin master
else
    git clone $GITHUB_REPO $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 安装依赖
echo "📦 安装项目依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 配置PM2
echo "⚙️ 配置PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'npm',
    args: 'start',
    cwd: '$PROJECT_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    }
  }]
}
EOF

# 启动应用
echo "🚀 启动应用..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 安装和配置Nginx
echo "🌐 配置Nginx..."
apt-get install -y nginx

# 创建Nginx配置（全球访问优化）
cat > /etc/nginx/sites-available/$PROJECT_NAME << EOF
# 全球访问优化配置
server {
    listen 80;
    server_name $DOMAIN _;
    
    # 启用Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API请求不缓存
    location /api/ {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 跨域配置
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    }
    
    # 主应用
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 连接超时优化
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 启用站点
ln -s /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

# 重启Nginx
systemctl restart nginx
systemctl enable nginx

# 配置防火墙
echo "🔒 配置防火墙..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo "✅ 部署完成！"
echo "🌐 访问地址: http://$(curl -s ifconfig.me)"
echo "📊 查看应用状态: pm2 status"
echo "📝 查看应用日志: pm2 logs $PROJECT_NAME"
echo "🔄 重启应用: pm2 restart $PROJECT_NAME"