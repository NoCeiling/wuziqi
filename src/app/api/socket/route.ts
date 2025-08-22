import { NextResponse } from 'next/server'

// Vercel 不支持持久的 Socket.IO 服务器
// 我们需要使用其他方式实现实时通信
// 这里我们返回一个信息，告诉客户端使用轮询或其他方案

export async function GET() {
  return NextResponse.json({ 
    message: 'Socket.IO not supported in Vercel serverless environment',
    suggestion: 'Consider using Vercel WebSocket API or external WebSocket service'
  })
}

export async function POST() {
  return NextResponse.json({ 
    message: 'Socket.IO not supported in Vercel serverless environment' 
  })
}