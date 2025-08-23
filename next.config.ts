import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 服务端外部包配置
  serverExternalPackages: ['socket.io'],
  
  // 压缩优化
  compress: true,
  
  // 图片优化配置
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // 输出配置 - 确保与Vercel兼容
  output: 'standalone',
  
  // CORS头部设置
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
