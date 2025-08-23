import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 禁用开发模式功能在生产环境
  reactStrictMode: true,
  swcMinify: true,
  // 生产环境优化
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
  // 禁用开发模式特性
  devIndicators: {
    buildActivity: false,
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 生产环境下禁用HMR和WebSocket
      config.entry = async () => {
        const entries = await config.entry();
        // 移除开发模式相关的entry
        Object.keys(entries).forEach(key => {
          if (key.includes('_next/static/chunks/webpack') || 
              key.includes('_next/static/chunks/app-pages-browser') ||
              key.includes('hot-reload')) {
            delete entries[key];
          }
        });
        return entries;
      };
      
      // 优化打包
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all'
            }
          }
        }
      };
    }
    return config;
  }
};

export default nextConfig;
