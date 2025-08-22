'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateInviteCode, validateInviteCode } from '@/lib/utils'
import { Users, Plus, LogIn, Gamepad2 } from 'lucide-react'

export default function Home() {
  const [playerName, setPlayerName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const router = useRouter()

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert('请输入玩家名称')
      return
    }
    
    setIsCreating(true)
    // 生成邀请码并跳转到房间页面
    const code = generateInviteCode()
    router.push(`/room/${code}?name=${encodeURIComponent(playerName.trim())}&create=true`)
  }

  const handleJoinRoom = async () => {
    console.log('加入房间按钮被点击了！')
    
    // 验证输入
    if (!playerName.trim()) {
      alert('请先输入您的名称')
      return
    }
    
    if (!inviteCode.trim()) {
      alert('请输入房间邀请码')
      return
    }
    
    const codeToValidate = inviteCode.trim().toUpperCase()
    
    if (codeToValidate.length !== 6) {
      alert('邀请码必须是6位字符')
      return
    }
    
    if (!validateInviteCode(codeToValidate)) {
      alert('邀请码格式错误，只能包含字母和数字')
      return
    }
    
    console.log('准备跳转到:', `/room/${codeToValidate}?name=${encodeURIComponent(playerName.trim())}`)
    
    setIsJoining(true)
    setTimeout(() => {
      try {
        router.push(`/room/${codeToValidate}?name=${encodeURIComponent(playerName.trim())}`)
      } catch (error) {
        console.error('跳转错误:', error)
        setIsJoining(false)
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* 标题 - 简洁现代风格 */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Gamepad2 className="h-12 w-12 text-blue-400" />
            <h1 className="text-6xl font-light text-white tracking-tight">
              五子棋
            </h1>
          </div>
          <p className="text-gray-400 text-lg font-light">
            简洁优雅的在线对战平台
          </p>
        </div>

        {/* 玩家名称输入 - 全局共用 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="space-y-4">
            <label className="block text-white/90 text-sm font-medium" htmlFor="playerName">
              您的名称 <span className="text-red-400">*</span>
            </label>
            <input
              id="playerName"
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="请先输入您的名称（必填）"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
            />
            {!playerName.trim() && (
              <p className="text-yellow-400 text-sm">
                ⚠️ 创建或加入房间前，请先填写您的名称
              </p>
            )}
          </div>
        </div>

        {/* 创建房间 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="space-y-4">
            <h3 className="text-white text-lg font-medium text-center">创建新房间</h3>
            <button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-xl"
              onClick={handleCreateRoom}
              disabled={isCreating || !playerName.trim()}
            >
              <div className="flex items-center justify-center space-x-3">
                <Plus className="h-5 w-5" />
                <span className="text-lg">
                  {isCreating ? '创建中...' : '创建新房间'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 分割线 */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/20"></div>
          <span className="text-white/60 text-sm font-light">或</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/20"></div>
        </div>

        {/* 加入房间 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="space-y-4">
            <h3 className="text-white text-lg font-medium text-center">加入已有房间</h3>
            
            {/* 提醒信息 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-300 text-sm text-center">
                💡 请确保上方已填写您的名称，然后输入房间邀请码
              </p>
            </div>
            
            <div>
              <label className="block text-white/90 text-sm font-medium mb-2" htmlFor="inviteCodeInput">
                房间邀请码 <span className="text-red-400">*</span>
              </label>
              <input
                id="inviteCodeInput"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all text-center text-xl font-mono tracking-widest"
                placeholder="输入6位邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              
              {/* 实时验证提示 */}
              {inviteCode.trim() && inviteCode.trim().length < 6 && (
                <p className="text-yellow-400 text-sm mt-2 text-center">
                  邀请码需要6位字符 ({inviteCode.trim().length}/6)
                </p>
              )}
              {inviteCode.trim().length === 6 && !validateInviteCode(inviteCode.trim()) && (
                <p className="text-red-400 text-sm mt-2 text-center">
                  邀请码格式错误，只能包含字母和数字
                </p>
              )}
              {inviteCode.trim().length === 6 && validateInviteCode(inviteCode.trim()) && (
                <p className="text-green-400 text-sm mt-2 text-center">
                  ✓ 邀请码格式正确
                </p>
              )}
            </div>
            
            <button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg disabled:opacity-50"
              onClick={handleJoinRoom}
              disabled={isJoining || !playerName.trim()}
              type="button"
            >
              <div className="flex items-center justify-center space-x-3">
                <LogIn className="h-5 w-5" />
                <span className="text-lg">
                  {isJoining ? '加入中...' : '加入房间'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center pt-4">
          <p className="text-white/40 text-sm font-light">
            © 2024 五子棋在线对战
          </p>
        </div>
      </div>
    </div>
  )
}