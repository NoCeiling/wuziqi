#!/bin/bash

# 🎮 五子棋项目完整部署脚本 - 腾讯云轻量服务器
# 服务器IP: 43.160.244.56
# 域名: wuziqigo.com
# 配置: 2核4G内存优化版

echo "🌟 开始部署五子棋项目到腾讯云服务器"

# 项目配置
PROJECT_NAME="wuziqi"
PROJECT_DIR="/var/www/$PROJECT_NAME"
GITHUB_REPO="https://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@github.com/NoCeiling/wuziqi.git"
PORT=3000
DOMAIN="wuziqigo.com"
SERVER_IP="43.160.244.56"

# 检查root权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用sudo运行此脚本: sudo bash deploy-complete.sh"
    exit 1
fi

echo "🔧 服务器信息："
echo "   IP地址: $SERVER_IP"
echo "   域名: $DOMAIN"
echo "   项目端口: $PORT"
echo ""

# 1. 系统更新
echo "📦 更新系统..."
apt-get update && apt-get upgrade -y

# 2. 安装Node.js 18.x
echo "📦 安装Node.js 18.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "✅ Node.js版本: $(node --version)"
echo "✅ NPM版本: $(npm --version)"

# 3. 配置npm（2G内存优化）
npm config set max_old_space_size=1536

# 4. 安装必要工具
echo "📦 安装工具..."
npm install -g pm2
apt-get install -y git nginx certbot python3-certbot-nginx

# 5. 创建项目目录并克隆代码
echo "📥 下载项目代码..."
rm -rf $PROJECT_DIR
mkdir -p $PROJECT_DIR

# 克隆项目（使用你的Token）
git clone $GITHUB_REPO $PROJECT_DIR
cd $PROJECT_DIR

# 6. 安装依赖
echo "📦 安装项目依赖..."
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci

# 7. 构建项目
echo "🔨 构建项目..."
npm run build

# 8. 配置PM2
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
    max_memory_restart: '800M',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    error_file: '/var/log/pm2/$PROJECT_NAME-error.log',
    out_file: '/var/log/pm2/$PROJECT_NAME-out.log',
    log_file: '/var/log/pm2/$PROJECT_NAME.log'
  }]
}
EOF

# 创建日志目录
mkdir -p /var/log/pm2

# 9. 配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/$PROJECT_NAME << EOF
# 五子棋网站配置 - wuziqigo.com
server {
    listen 80;
    server_name wuziqigo.com www.wuziqigo.com $SERVER_IP;
    
    # 临时重定向到HTTPS（SSL证书申请后启用）
    # return 301 https://\$server_name\$request_uri;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/javascript 
        application/xml+rss 
        application/json
        image/svg+xml;
    
    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Next.js静态文件
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API和应用代理
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
        
        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 跨域配置（如需要）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
echo "🔍 测试Nginx配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx配置正确"
else
    echo "❌ Nginx配置有误，请检查"
    exit 1
fi

# 10. 启动服务
echo "🚀 启动应用..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 启动Nginx
systemctl restart nginx
systemctl enable nginx

# 11. 配置防火墙
echo "🔒 配置防火墙..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# 12. 申请SSL证书
echo "🔒 申请SSL证书..."
echo "正在为域名 $DOMAIN 申请SSL证书..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# 13. 系统优化
echo "⚡ 系统优化..."
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'fs.file-max=65536' >> /etc/sysctl.conf
sysctl -p

# 14. 创建管理脚本
cat > /usr/local/bin/wuziqi-status.sh << 'EOF'
#!/bin/bash
echo "=== 🎮 五子棋游戏状态监控 ==="
echo ""
echo "📊 系统资源："
free -h
echo ""
echo "🚀 PM2进程："
pm2 status
echo ""
echo "🌐 Nginx状态："
systemctl status nginx --no-pager -l
echo ""
echo "💾 磁盘使用："
df -h
echo ""
echo "🔗 访问地址："
echo "   HTTP:  http://wuziqigo.com"
echo "   HTTPS: https://wuziqigo.com"
echo "   IP:    http://43.160.244.56"
EOF

chmod +x /usr/local/bin/wuziqi-status.sh

# 15. 创建更新脚本
cat > /usr/local/bin/wuziqi-update.sh << 'EOF'
#!/bin/bash
echo "🔄 更新五子棋项目..."
cd /var/www/wuziqi
git pull origin main
npm ci
npm run build
pm2 restart wuziqi
echo "✅ 更新完成！"
EOF

chmod +x /usr/local/bin/wuziqi-update.sh

# 16. 最终检查
echo ""
echo "🔍 最终检查..."
sleep 3

echo "检查PM2进程..."
pm2 status

echo "检查端口监听..."
netstat -tlnp | grep :80
netstat -tlnp | grep :3000

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址："
echo "   🔗 HTTP:  http://wuziqigo.com"
echo "   🔗 HTTPS: https://wuziqigo.com" 
echo "   🔗 IP:    http://$SERVER_IP"
echo ""
echo "📊 管理命令："
echo "   📈 查看状态: wuziqi-status.sh"
echo "   🔄 更新项目: wuziqi-update.sh"
echo "   📝 查看日志: pm2 logs wuziqi"
echo "   🔄 重启应用: pm2 restart wuziqi"
echo "   🌐 重启Nginx: systemctl restart nginx"
echo ""
echo "🎮 五子棋游戏已成功部署！开始享受游戏吧！"