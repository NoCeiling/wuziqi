'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Room } from '@/types/game'
import { cn, generateRoomId } from '@/lib/utils'
import { Copy, Users, Clock, Crown, User, ArrowLeft, Trophy } from 'lucide-react'

export default function RoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const code = params.code as string
  const playerName = searchParams.get('name') || ''
  const isCreating = searchParams.get('create') === 'true'
  
  const [playerId] = useState(() => generateRoomId())
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // API 调用函数
  const callGameAPI = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId, ...data })
      })
      return await response.json()
    } catch (error) {
      console.error('API call failed:', error)
      return { success: false, error: '网络错误' }
    }
  }, [playerId])

  // 获取房间状态
  const fetchRoomState = useCallback(async () => {
    try {
      const response = await fetch(`/api/game?code=${code}`)
      const result = await response.json()
      if (result.success) {
        setRoom(result.room)
        setError('')
      } else {
        setError(result.error)
      }
    } catch (error) {
      console.error('Failed to fetch room state:', error)
      setError('网络错误')
    }
  }, [code])

  // 初始化房间
  useEffect(() => {
    if (!playerName) {
      router.push('/')
      return
    }

    const initRoom = async () => {
      setLoading(true)
      
      if (isCreating) {
        // 创建房间
        const result = await callGameAPI('create-room', { playerName })
        if (result.success) {
          setRoom(result.room)
          // 替换 URL 为新生成的房间码
          router.replace(`/room/${result.room.code}?name=${encodeURIComponent(playerName)}`)
        } else {
          setError(result.error)
        }
      } else {
        // 加入房间
        const result = await callGameAPI('join-room', { code, playerName })
        if (result.success) {
          setRoom(result.room)
        } else {
          setError(result.error)
        }
      }
      
      setLoading(false)
    }

    initRoom()
  }, [code, playerName, isCreating, router, callGameAPI])

  // 轮询房间状态
  useEffect(() => {
    if (!room) return

    const interval = setInterval(fetchRoomState, 2000) // 每2秒轮询一次
    return () => clearInterval(interval)
  }, [room, fetchRoomState])

  const handleCopyCode = () => {
    const currentCode = room?.code || code
    navigator.clipboard.writeText(currentCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartGame = async () => {
    const result = await callGameAPI('start-game')
    if (result.success) {
      setRoom(result.room)
    } else {
      alert(result.error)
    }
  }

  const handleMakeMove = async (row: number, col: number) => {
    if (room?.gameStatus !== 'playing') return
    if (room.board[row][col] !== null) return
    
    const currentPlayer = room.players.find(p => p.id === playerId)
    if (!currentPlayer || currentPlayer.color !== room.currentPlayer) return
    
    const result = await callGameAPI('make-move', { position: { row, col } })
    if (result.success) {
      setRoom(result.room)
    } else {
      alert(result.error)
    }
  }

  const handleLeaveRoom = async () => {
    await callGameAPI('leave-room')
    router.push('/')
  }

  const renderBoard = () => {
    if (!room) return null
    
    return (
      <div className="grid grid-cols-15 gap-1 bg-amber-100 p-4 rounded-lg border-2 border-amber-300 aspect-square max-w-lg mx-auto">
        {room.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "aspect-square rounded-sm border border-amber-300 transition-colors flex items-center justify-center",
                "hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-blue-500",
                cell === null ? "bg-amber-50" : ""
              )}
              onClick={() => handleMakeMove(rowIndex, colIndex)}
              disabled={room.gameStatus !== 'playing' || cell !== null}
            >
              {cell && (
                <div
                  className={cn(
                    "w-full h-full rounded-full border-2",
                    cell === 'black' 
                      ? "bg-gray-800 border-gray-900" 
                      : "bg-white border-gray-300 shadow-sm"
                  )}
                />
              )}
            </button>
          ))
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">初始化中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">错误</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  const currentPlayer = room.players.find(p => p.id === playerId)
  const isRoomOwner = room.players[0]?.id === playerId
  const canStartGame = room.players.length === 2 && room.gameStatus === 'waiting' && isRoomOwner

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={handleLeaveRoom} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>离开房间</span>
          </Button>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">房间代码:</span>
              <Button
                variant="outline"
                onClick={handleCopyCode}
                className="flex items-center space-x-2 font-mono"
              >
                <span className="text-lg font-bold">{room.code}</span>
                <Copy className="h-4 w-4" />
              </Button>
              {copied && (
                <span className="text-sm text-green-600">已复制!</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 游戏区域 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>五子棋游戏</span>
                  {room.gameStatus === 'playing' && (
                    <Badge variant={room.currentPlayer === 'black' ? 'default' : 'secondary'}>
                      当前: {room.currentPlayer === 'black' ? '黑棋' : '白棋'}
                    </Badge>
                  )}
                  {room.gameStatus === 'finished' && room.winner && (
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <Trophy className="h-4 w-4" />
                      <span>{room.winner === 'black' ? '黑棋' : '白棋'}获胜!</span>
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderBoard()}
                
                {/* 游戏控制 */}
                <div className="mt-6 flex justify-center space-x-4">
                  {room.gameStatus === 'waiting' && canStartGame && (
                    <Button onClick={handleStartGame} className="flex items-center space-x-2">
                      <span>开始游戏</span>
                    </Button>
                  )}
                  
                  {room.gameStatus === 'waiting' && !canStartGame && (
                    <p className="text-gray-600 text-center">
                      {room.players.length < 2 ? '等待另一位玩家加入...' : '等待房主开始游戏...'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 玩家信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>玩家 ({room.players.length}/2)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {room.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      player.id === playerId ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      {index === 0 && <Crown className="h-4 w-4 text-yellow-600" />}
                      <User className="h-4 w-4" />
                      <span className="font-medium">{player.name}</span>
                      {player.id === playerId && (
                        <Badge variant="outline" className="text-xs">你</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {player.color && (
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2",
                            player.color === 'black' 
                              ? "bg-gray-800 border-gray-900" 
                              : "bg-white border-gray-300"
                          )}
                        />
                      )}
                      <Badge variant={player.color === 'black' ? 'default' : 'secondary'}>
                        {player.color === 'black' ? '黑棋' : player.color === 'white' ? '白棋' : '观战'}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {room.players.length < 2 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>等待玩家加入...</p>
                    <p className="text-sm mt-1">分享房间代码给朋友</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 游戏状态 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>游戏状态</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">状态:</span>
                    <Badge 
                      variant={
                        room.gameStatus === 'playing' ? 'default' : 
                        room.gameStatus === 'finished' ? 'secondary' : 'outline'
                      }
                    >
                      {room.gameStatus === 'waiting' && '等待中'}
                      {room.gameStatus === 'playing' && '进行中'}
                      {room.gameStatus === 'finished' && '已结束'}
                    </Badge>
                  </div>
                  
                  {room.gameStatus === 'playing' && currentPlayer && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">轮到:</span>
                      <Badge variant={room.currentPlayer === currentPlayer.color ? 'default' : 'outline'}>
                        {room.currentPlayer === currentPlayer.color ? '你的回合' : '对方回合'}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}