#!/bin/bash

# 腾讯云轻量服务器部署脚本
# 针对2核2G内存优化配置
# 使用方法：chmod +x deploy-tencent.sh && ./deploy-tencent.sh

echo "🌟 开始部署五子棋项目到腾讯云服务器（2G内存优化版）"

# 设置变量
PROJECT_NAME="wuziqi"
PROJECT_DIR="/var/www/$PROJECT_NAME"
GITHUB_REPO="https://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@github.com/NoCeiling/wuziqi.git"
PORT=3000
DOMAIN="wuziqigo.com"  # 您的五子棋域名

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用sudo运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
apt-get update && apt-get upgrade -y

# 安装Node.js 18.x（2G内存优化版本）
echo "📦 安装Node.js 18.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# 验证Node.js安装
echo "✅ Node.js版本: $(node --version)"
echo "✅ NPM版本: $(npm --version)"

# 配置npm内存限制（2G内存优化）
echo "⚙️ 配置npm内存限制..."
npm config set max_old_space_size=1536

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
    git pull origin main
else
    git clone $GITHUB_REPO $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 安装依赖（分批安装减少内存压力）
echo "📦 安装项目依赖（内存优化模式）..."
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci --production=false

# 构建项目（内存优化）
echo "🔨 构建项目（内存优化）..."
npm run build

# 配置PM2（2G内存优化配置）
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
    max_memory_restart: '800M',  // 2G内存下限制单进程800M
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

# 启动应用
echo "🚀 启动应用..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 安装Nginx和Certbot（用于SSL证书）
echo "🌐 配置Nginx和SSL证书..."
apt-get install -y nginx certbot python3-certbot-nginx

# 创建Nginx配置（2G内存优化 + SSL支持）
cat > /etc/nginx/sites-available/$PROJECT_NAME << EOF
# 五子棋网站配置 - 支持HTTPS
server {
    listen 80;
    server_name wuziqigo.com www.wuziqigo.com;
    
    # 重定向HTTP到HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wuziqigo.com www.wuziqigo.com;
    
    # SSL证书路径（Let's Encrypt会自动配置）
    # ssl_certificate /etc/letsencrypt/live/wuziqigo.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/wuziqigo.com/privkey.pem;
    
    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # 内存优化：启用Gzip压缩
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
    
    # 静态文件缓存（减少服务器压力）
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
        
        # 腾讯云优化：跨域配置
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        # 超时优化（2G内存环境）
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
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
        
        # 超时优化
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 缓存静态内容
        proxy_cache_valid 200 302 5m;
        proxy_cache_valid 404 1m;
    }
}
EOF

# 启用站点
ln -s /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 优化Nginx配置（2G内存）
cat > /etc/nginx/nginx.conf << EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;  # 2G内存下适中配置
    use epoll;
    multi_accept on;
}

http {
    # 基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # 内存优化
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    
    # MIME类型
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # 日志配置
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Gzip配置
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# 测试Nginx配置
nginx -t

# 启用站点并重启Nginx
systemctl restart nginx
systemctl enable nginx

# 申请SSL证书（Let's Encrypt）
echo "🔒 申请SSL证书..."
certbot --nginx -d wuziqigo.com -d www.wuziqigo.com --non-interactive --agree-tos --email admin@wuziqigo.com

# 设置SSL证书自动续期
echo "⏰ 配置SSL证书自动续期..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# 配置防火墙（腾讯云轻量服务器）
echo "🔒 配置防火墙..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# 配置系统优化（2G内存）
echo "⚡ 系统性能优化..."
# 设置swappiness
echo 'vm.swappiness=10' >> /etc/sysctl.conf
# 优化文件描述符
echo 'fs.file-max=65536' >> /etc/sysctl.conf
sysctl -p

# 创建监控脚本
cat > /usr/local/bin/monitor.sh << 'EOF'
#!/bin/bash
echo "=== 系统资源监控 ==="
echo "内存使用情况："
free -h
echo ""
echo "CPU使用情况："
top -bn1 | grep "Cpu(s)"
echo ""
echo "PM2进程状态："
pm2 status
echo ""
echo "磁盘使用情况："
df -h
EOF

chmod +x /usr/local/bin/monitor.sh

echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址: http://43.160.244.56"
echo "📊 系统监控: /usr/local/bin/monitor.sh"
echo "📊 查看应用状态: pm2 status"
echo "📝 查看应用日志: pm2 logs $PROJECT_NAME"
echo "🔄 重启应用: pm2 restart $PROJECT_NAME"
echo "🔧 Nginx状态: systemctl status nginx"
echo ""
echo "🎮 五子棋游戏部署成功！开始享受游戏吧！"