import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from 'uuid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成6位随机邀请码
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  // 添加时间戳的最后两位来增加唯一性
  const timestamp = Date.now().toString()
  const timeChars = timestamp.slice(-2)
  
  // 如果生成的码长度不足6位，用时间戳字符替换最后几位
  if (result.length >= 2) {
    result = result.slice(0, 4) + timeChars
  }
  
  return result
}

// 生成唯一房间ID
export function generateRoomId(): string {
  return uuidv4()
}

// 验证邀请码格式
export function validateInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code)
}