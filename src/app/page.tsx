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

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      alert('请输入玩家名称')
      return
    }
    
    if (!inviteCode.trim()) {
      alert('请输入邀请码')
      return
    }
    
    if (!validateInviteCode(inviteCode.trim().toUpperCase())) {
      alert('邀请码格式错误，请输入6位字母数字组合')
      return
    }
    
    setIsJoining(true)
    router.push(`/room/${inviteCode.trim().toUpperCase()}?name=${encodeURIComponent(playerName.trim())}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Gamepad2 className="h-8 w-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">在线五子棋</h1>
          </div>
          <p className="text-gray-600">与朋友一起享受经典五子棋游戏</p>
        </div>

        {/* 玩家名称输入 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>玩家信息</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="playerName">玩家名称</Label>
              <Input
                id="playerName"
                placeholder="请输入您的名称"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>
          </CardContent>
        </Card>

        {/* 创建房间 */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-green-800 flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>创建房间</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700" 
              onClick={handleCreateRoom}
              disabled={isCreating || !playerName.trim()}
            >
              {isCreating ? '创建中...' : '创建新房间'}
            </Button>
            <p className="text-sm text-green-700 mt-2 text-center">
              创建房间后将获得邀请码，分享给朋友即可开始游戏
            </p>
          </CardContent>
        </Card>

        {/* 加入房间 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-800 flex items-center space-x-2">
              <LogIn className="h-5 w-5" />
              <span>加入房间</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">邀请码</Label>
              <Input
                id="inviteCode"
                placeholder="请输入6位邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="font-mono text-center text-lg tracking-wider"
              />
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={handleJoinRoom}
              disabled={isJoining || !playerName.trim() || !inviteCode.trim()}
            >
              {isJoining ? '加入中...' : '加入房间'}
            </Button>
          </CardContent>
        </Card>

        {/* 底部信息 */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2024 在线五子棋 - 支持实时对战</p>
        </div>
      </div>
    </div>
  )
}
