'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Room } from '@/types/game'
import { cn, generateRoomId } from '@/lib/utils'
import { Copy, Users, Clock, Crown, User, ArrowLeft, Trophy, Palette } from 'lucide-react'

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
  const [boardStyle, setBoardStyle] = useState<'classic' | 'vintage'>('vintage') // 添加棋盘风格状态
  
  // 棋盘颜色配置状态
  const [classicColors, setClassicColors] = useState({
    baseplate: '#654321',  // 最外层背景板
    background: '#F4E4BC', // 经典棋盘背景色
    border: '#8B4513',      // 经典棋盘边框色
    lines: '#8B4513'        // 经典棋盘线条色
  })
  
  const [vintageColors, setVintageColors] = useState({
    baseplate: '#4A3728',  // 最外层背景板
    background: '#DEB887',  // 复古棋盘背景色
    border: '#654321',      // 复古棋盘边框色
    grid: '#8B4513'         // 复古棋盘网格色
  })

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
        console.warn('获取房间状态失败:', result.error)
        // 如果房间不存在，可能是服务器重启了，停止轮询
        if (result.error === '房间不存在') {
          setError('连接中断，房间可能已失效。请重新创建房间。')
          // 停止轮询，避免持续的无效请求
          return 'stop-polling'
        }
        setError(result.error)
      }
    } catch (error) {
      console.error('Failed to fetch room state:', error)
      setError('网络错误')
    }
    return 'continue'
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

    const interval = setInterval(async () => {
      const result = await fetchRoomState()
      if (result === 'stop-polling') {
        clearInterval(interval)
      }
    }, 2000) // 每2秒轮询一次
    
    return () => clearInterval(interval)
  }, [room, fetchRoomState])

  const handleCopyCode = async () => {
    const currentCode = room?.code || code
    console.log('准备复制房间码:', currentCode, '类型:', typeof currentCode) // 详细调试日志
    
    // 确保房间码是字符串且不为空
    if (!currentCode || typeof currentCode !== 'string') {
      console.error('房间码无效:', currentCode)
      alert('复制失败：房间码无效')
      return
    }
    
    try {
      let copySuccess = false
      
      // 方法1: 现代浏览器使用 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(currentCode)
          console.log('使用 Clipboard API 复制成功，内容:', currentCode) // 调试日志
          copySuccess = true
        } catch (clipboardError) {
          console.warn('Clipboard API 失败:', clipboardError)
        }
      }
      
      // 方法2: 备用方案 - document.execCommand
      if (!copySuccess) {
        const textArea = document.createElement('textarea')
        textArea.value = currentCode
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        textArea.style.opacity = '0'
        textArea.setAttribute('readonly', '')
        textArea.setAttribute('aria-hidden', 'true')
        document.body.appendChild(textArea)
        
        textArea.focus()
        textArea.select()
        textArea.setSelectionRange(0, currentCode.length)
        
        const result = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        console.log('使用 execCommand 复制结果:', result, '内容:', currentCode) // 调试日志
        copySuccess = result
      }
      
      // 方法3: 最后的备用方案 - 使用input元素
      if (!copySuccess) {
        const input = document.createElement('input')
        input.value = currentCode
        input.style.position = 'fixed'
        input.style.left = '-999999px'
        input.style.top = '-999999px'
        input.style.opacity = '0'
        document.body.appendChild(input)
        
        input.focus()
        input.select()
        input.setSelectionRange(0, currentCode.length)
        
        const result = document.execCommand('copy')
        document.body.removeChild(input)
        
        console.log('使用 input+execCommand 复制结果:', result, '内容:', currentCode) // 调试日志
        copySuccess = result
      }
      
      if (copySuccess) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        
        // 显示成功提示，不使用alert，改用更友好的提示
        console.log('复制成功，房间码:', currentCode)
      } else {
        throw new Error('所有复制方法都失败了')
      }
      
    } catch (err) {
      console.error('复制失败:', err)
      // 如果所有方法都失败，显示错误信息和手动复制提示
      const fallbackText = `复制功能异常，请手动复制房间码: ${currentCode}`
      alert(fallbackText)
      
      // 尝试选中显示的房间码文本供用户手动复制
      try {
        const codeElement = document.querySelector('[data-room-code]')
        if (codeElement && window.getSelection) {
          const selection = window.getSelection()
          const range = document.createRange()
          range.selectNodeContents(codeElement)
          selection?.removeAllRanges()
          selection?.addRange(range)
          console.log('已选中房间码文本供手动复制')
        }
      } catch (selectionError) {
        console.error('选中文本失败:', selectionError)
      }
    }
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

  // 经典传统棋盘风格（类似图片中的样式）- 精致版
  const renderClassicBoard = () => {
    if (!room) return null
    
    return (
      <div className="relative">
        {/* 最外层背景板 - 用户可调色 */}
        <div className="p-4 rounded-3xl" style={{
          backgroundColor: classicColors.baseplate,
          boxShadow: `0 12px 48px ${classicColors.baseplate}80, inset 0 2px 0 rgba(255, 255, 255, 0.1)`
        }}>
          {/* 中层装饰边框 */}
          <div className="p-2 rounded-2xl" style={{
            backgroundColor: classicColors.border,
            boxShadow: `0 8px 32px ${classicColors.border}99, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}>
          <div 
            className="grid grid-cols-15 gap-0 p-6 rounded-xl border-2 aspect-square max-w-lg mx-auto relative"
            style={{
              borderColor: classicColors.border,
              backgroundColor: classicColors.background,
              backgroundSize: 'calc(100% / 15) calc(100% / 15)',
              boxShadow: `inset 0 2px 8px ${classicColors.border}4D, inset 0 0 20px ${classicColors.border}1A`
            }}
          >
            {/* 棋盘网格线 */}
            <div className="absolute inset-6 pointer-events-none">
              {/* 横线 */}
              {Array.from({ length: 15 }, (_, i) => (
                <div 
                  key={`h-${i}`}
                  className="absolute w-full border-t-2"
                  style={{ 
                    top: `${(i / 14) * 100}%`,
                    borderColor: classicColors.lines,
                    opacity: 0.7,
                    filter: `drop-shadow(0 1px 1px ${classicColors.lines}4D)`
                  }}
                />
              ))}
              {/* 竖线 */}
              {Array.from({ length: 15 }, (_, i) => (
                <div 
                  key={`v-${i}`}
                  className="absolute h-full border-l-2"
                  style={{ 
                    left: `${(i / 14) * 100}%`,
                    borderColor: classicColors.lines,
                    opacity: 0.7,
                    filter: `drop-shadow(1px 0 1px ${classicColors.lines}4D)`
                  }}
                />
              ))}
            </div>
            
            {room.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                // 计算是否是星点位置
                const isStarPoint = (
                  (rowIndex === 3 && colIndex === 3) ||
                  (rowIndex === 3 && colIndex === 11) ||
                  (rowIndex === 11 && colIndex === 3) ||
                  (rowIndex === 11 && colIndex === 11) ||
                  (rowIndex === 7 && colIndex === 7)
                )
                
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={cn(
                      "aspect-square flex items-center justify-center relative transition-all duration-300 z-10",
                      "hover:bg-yellow-200/40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 rounded-sm"
                    )}
                    onClick={() => handleMakeMove(rowIndex, colIndex)}
                    disabled={room.gameStatus !== 'playing' || cell !== null}
                  >
                    {/* 星点标记 - 更精致 */}
                    {isStarPoint && cell === null && (
                      <div 
                        className="absolute w-3 h-3 rounded-full"
                        style={{
                          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                          background: `linear-gradient(to bottom right, ${classicColors.lines}, ${classicColors.border})`,
                          boxShadow: `0 1px 3px ${classicColors.border}80, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        }}
                      ></div>
                    )}
                    
                    {cell && (
                      <div
                        className={cn(
                          "w-[85%] h-[85%] rounded-full border-2 relative shadow-2xl transition-all duration-500 transform hover:scale-105",
                          cell === 'black' 
                            ? "bg-gradient-radial from-gray-300 via-gray-700 to-black border-gray-950" 
                            : "bg-gradient-radial from-white via-gray-50 to-gray-200 border-gray-400"
                        )}
                        style={{
                          boxShadow: cell === 'black' 
                            ? '0 6px 20px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6), inset -2px -2px 6px rgba(255, 255, 255, 0.15)' 
                            : '0 6px 20px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2), inset 2px 2px 6px rgba(0, 0, 0, 0.1), inset -1px -1px 3px rgba(255, 255, 255, 0.8)',
                          background: cell === 'black'
                            ? 'radial-gradient(circle at 35% 35%, #666 0%, #333 30%, #111 70%, #000 100%)'
                            : 'radial-gradient(circle at 35% 35%, #fff 0%, #f5f5f5 30%, #e0e0e0 70%, #d0d0d0 100%)'
                        }}
                      >
                        {/* 棋子高光效果 - 更立体 */}
                        <div 
                          className={cn(
                            "absolute rounded-full",
                            cell === 'black' 
                              ? "bg-gradient-to-br from-white/40 via-white/20 to-transparent" 
                              : "bg-gradient-to-br from-white/90 via-white/60 to-transparent"
                          )}
                          style={{
                            top: '15%', left: '15%', width: '45%', height: '45%',
                            filter: 'blur(0.5px)'
                          }}
                        ></div>
                        
                        {/* 额外的内阴影效果 */}
                        <div 
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: cell === 'black'
                              ? 'radial-gradient(circle at 70% 70%, transparent 60%, rgba(0,0,0,0.3) 100%)'
                              : 'radial-gradient(circle at 70% 70%, transparent 60%, rgba(0,0,0,0.1) 100%)'
                          }}
                        ></div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
        </div>
      </div>
    )
  }

  // 复古木质棋盘风格（原有风格）- 精致版
  const renderVintageBoard = () => {
    if (!room) return null
    
    return (
      <div className="relative">
        {/* 最外层背景板 - 用户可调色 */}
        <div className="p-4 rounded-3xl" style={{
          backgroundColor: vintageColors.baseplate,
          boxShadow: `0 16px 56px ${vintageColors.baseplate}80, inset 0 3px 0 rgba(255, 255, 255, 0.08)`
        }}>
          {/* 中层装饰框架 */}
          <div className="p-3 rounded-2xl" style={{
            backgroundColor: vintageColors.border,
            boxShadow: `0 12px 40px ${vintageColors.border}B3, inset 0 2px 0 rgba(255, 255, 255, 0.15)`
          }}>
          {/* 木质背景效果 - 增强版 */}
          <div 
            className="grid grid-cols-15 gap-1 p-8 rounded-xl border-4 aspect-square max-w-lg mx-auto relative"
            style={{
              borderColor: vintageColors.border,
              backgroundColor: vintageColors.background,
              backgroundImage: `
                repeating-linear-gradient(45deg, transparent, transparent 20px, ${vintageColors.grid}08 20px, ${vintageColors.grid}08 22px),
                repeating-linear-gradient(-45deg, transparent, transparent 20px, ${vintageColors.grid}05 20px, ${vintageColors.grid}05 22px)
              `,
              backgroundSize: '40px 40px, 40px 40px',
              boxShadow: `inset 0 4px 12px ${vintageColors.border}66, inset 0 0 30px ${vintageColors.border}33`
            }}
          >
            {/* 简化的木纹纹理效果 */}
            <div className="absolute inset-0 rounded-xl opacity-20 pointer-events-none" style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, 
                  transparent 0%, 
                  ${vintageColors.grid}15 1px, 
                  transparent 2px, 
                  transparent 15px
                )
              `
            }}></div>
            
            {room.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                // 计算是否是星点位置
                const isStarPoint = (
                  (rowIndex === 3 && colIndex === 3) ||
                  (rowIndex === 3 && colIndex === 11) ||
                  (rowIndex === 11 && colIndex === 3) ||
                  (rowIndex === 11 && colIndex === 11) ||
                  (rowIndex === 7 && colIndex === 7)
                )
                
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={cn(
                      "aspect-square rounded-md transition-all duration-300 flex items-center justify-center relative z-10",
                      "hover:bg-yellow-200/50 hover:shadow-lg focus:outline-none focus:ring-3 focus:ring-yellow-500 focus:ring-opacity-50",
                      "border border-amber-700/30",
                      cell === null ? "bg-gradient-to-br from-yellow-100/60 to-amber-200/60 backdrop-blur-sm" : ""
                    )}
                    style={{
                      boxShadow: cell === null ? 'inset 2px 2px 6px rgba(139, 69, 19, 0.3), inset -1px -1px 3px rgba(255, 255, 255, 0.2)' : 'none'
                    }}
                    onClick={() => handleMakeMove(rowIndex, colIndex)}
                    disabled={room.gameStatus !== 'playing' || cell !== null}
                  >
                    {/* 棋盘线条效果 - 增强版 */}
                    {cell === null && (
                      <>
                        <div className="absolute inset-0 border-t-2 border-l-2 border-amber-800/40 rounded-md"></div>
                        {/* 星点标记 - 更精致 */}
                        {isStarPoint && (
                          <div 
                            className="absolute w-2.5 h-2.5 bg-gradient-to-br from-amber-700 to-amber-900 rounded-full"
                            style={{
                              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                              boxShadow: '0 1px 3px rgba(139, 69, 19, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                            }}
                          ></div>
                        )}
                      </>
                    )}
                    
                    {cell && (
                      <div
                        className={cn(
                          "w-[90%] h-[90%] rounded-full border-3 relative shadow-2xl",
                          "transition-all duration-500 transform hover:scale-110",
                          cell === 'black' 
                            ? "bg-gradient-to-br from-gray-600 via-gray-800 to-black border-gray-950" 
                            : "bg-gradient-to-br from-gray-50 via-white to-gray-100 border-gray-400"
                        )}
                        style={{
                          boxShadow: cell === 'black' 
                            ? '0 8px 25px rgba(0, 0, 0, 0.8), 0 3px 10px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.15), inset 0 -2px 6px rgba(0, 0, 0, 0.3)' 
                            : '0 8px 25px rgba(0, 0, 0, 0.4), 0 3px 10px rgba(0, 0, 0, 0.2), inset 0 3px 6px rgba(255, 255, 255, 0.9), inset 0 -2px 4px rgba(0, 0, 0, 0.1)',
                          background: cell === 'black'
                            ? 'radial-gradient(circle at 30% 30%, #555 0%, #333 25%, #222 60%, #111 80%, #000 100%)'
                            : 'radial-gradient(circle at 30% 30%, #fff 0%, #f8f8f8 25%, #f0f0f0 60%, #e8e8e8 80%, #e0e0e0 100%)'
                        }}
                      >
                        {/* 棋子的高光效果 - 更立体 */}
                        <div 
                          className={cn(
                            "absolute rounded-full",
                            cell === 'black' 
                              ? "bg-gradient-to-br from-white/50 via-white/25 to-transparent" 
                              : "bg-gradient-to-br from-white/95 via-white/70 to-transparent"
                          )}
                          style={{
                            top: '12%', left: '12%', width: '50%', height: '50%',
                            filter: 'blur(1px)'
                          }}
                        ></div>
                        
                        {/* 额外的光泽效果 */}
                        <div 
                          className="absolute rounded-full"
                          style={{
                            top: '20%', left: '20%', width: '25%', height: '25%',
                            background: cell === 'black' 
                              ? 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)'
                              : 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
                            filter: 'blur(0.5px)'
                          }}
                        ></div>
                        
                        {/* 底部阴影效果 */}
                        <div 
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: cell === 'black'
                              ? 'radial-gradient(circle at 75% 75%, transparent 50%, rgba(0,0,0,0.4) 100%)'
                              : 'radial-gradient(circle at 75% 75%, transparent 50%, rgba(0,0,0,0.15) 100%)'
                          }}
                        ></div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
        </div>
      </div>
    )
  }

  const renderBoard = () => {
    return boardStyle === 'classic' ? renderClassicBoard() : renderVintageBoard()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white font-medium text-lg">初始化中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-2xl font-light text-white mb-4 text-center">错误</h2>
          <p className="text-white/80 font-medium mb-6 text-center">{error}</p>
          <Button 
            onClick={() => router.push('/')} 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl transition-all"
          >
            返回首页
          </Button>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white font-medium text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  const currentPlayer = room.players.find(p => p.id === playerId)
  const isRoomOwner = room.players[0]?.id === playerId
  const canStartGame = room.players.length === 2 && room.gameStatus === 'waiting' && isRoomOwner

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      <div className="max-w-6xl mx-auto p-6">
        {/* 头部 - 简洁现代风格 */}
        <div className="flex items-center justify-between mb-8 bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <Button 
            onClick={handleLeaveRoom} 
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 hover:border-red-400 font-medium px-6 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            离开房间
          </Button>
          
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center space-x-3">
                <span className="text-white/80 font-medium">房间代码</span>
                <Button
                  onClick={handleCopyCode}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 hover:border-blue-400 font-mono font-bold px-4 py-2 rounded-lg transition-all"
                >
                  <span className="text-xl" data-room-code>{room.code}</span>
                  <Copy className="h-4 w-4 ml-2" />
                </Button>
                {copied && (
                  <span className="text-green-400 font-medium bg-green-500/20 px-3 py-1 rounded-full text-sm border border-green-500/30">已复制</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 游戏区域 - 保持复古棋盘风格 */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-6 bg-white/10 rounded-xl p-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-2xl font-light text-white">五子棋对弈</h2>
                  
                  {/* 棋盘风格切换 */}
                  <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                    <Palette className="h-4 w-4 text-white/60" />
                    <select 
                      value={boardStyle} 
                      onChange={(e) => setBoardStyle(e.target.value as 'classic' | 'vintage')}
                      className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="classic" className="bg-gray-800 text-white">经典风格</option>
                      <option value="vintage" className="bg-gray-800 text-white">复古风格</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  {room.gameStatus === 'playing' && (
                    <div className={`px-4 py-2 rounded-full font-medium shadow-lg ${
                      room.currentPlayer === 'black' 
                        ? 'bg-gray-800/80 text-white border border-gray-600' 
                        : 'bg-white/80 text-gray-900 border border-gray-300'
                    }`}>
                      当前轮到: {room.currentPlayer === 'black' ? '黑棋' : '白棋'}
                    </div>
                  )}
                  {room.gameStatus === 'finished' && room.winner && (
                    <div className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full font-medium text-yellow-900 shadow-lg flex items-center space-x-2">
                      <Trophy className="h-5 w-5" />
                      <span>{room.winner === 'black' ? '黑棋' : '白棋'}获胜!</span>
                    </div>
                  )}
                </div>
              </div>

              {renderBoard()}
              
              {/* 棋盘调色板 - 暂时隐藏 */}
              {false && (
              <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white text-sm font-medium">棋盘调色</h4>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-white/60">
                      当前风格: <span className="text-blue-300">{boardStyle === 'classic' ? '经典' : '复古'}</span>
                    </div>
                    <button 
                      className="text-xs text-blue-300 hover:text-blue-200 transition-colors px-2 py-1 bg-blue-500/20 rounded"
                                            onClick={() => {
                        if (boardStyle === 'classic') {
                          setClassicColors({
                            baseplate: '#654321',
                            background: '#F4E4BC',
                            border: '#8B4513', 
                            lines: '#8B4513'
                          })
                        } else {
                          setVintageColors({
                            baseplate: '#4A3728',
                            background: '#DEB887',
                            border: '#654321',
                            grid: '#8B4513'
                          })
                        }
                      }}
                    >
                      重置默认
                    </button>
                  </div>
                </div>
                
                {/* 棋盘结构说明 */}
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-xs text-blue-300 mb-2 font-medium">📍 棋盘结构说明：</div>
                  {boardStyle === 'classic' ? (
                    <div className="text-xs text-blue-200 space-y-1">
                      <div>• <span className="font-medium">背景板</span>：最外层的背景板（您指的这个）</div>
                      <div>• <span className="font-medium">边框色</span>：中层的棕色边框</div>
                      <div>• <span className="font-medium">背景色</span>：主要的棋盘背景区域</div>
                      <div>• <span className="font-medium">线条色</span>：15x15网格线条和星点</div>
                    </div>
                                    ) : (
                    <div className="text-xs text-blue-200 space-y-1">
                      <div>• <span className="font-medium">背景板</span>：最外层的背景板（您指的这个）</div>
                      <div>• <span className="font-medium">木框色</span>：中层的木质边框</div>
                      <div>• <span className="font-medium">木质背景</span>：主要的棋盘背景区域</div>
                      <div>• <span className="font-medium">网格色</span>：木纹纸理和网格线条</div>
                    </div>
                  )}
                </div>
                
                {boardStyle === 'classic' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>背景板</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: classicColors.baseplate }}></div>
                        <span className="text-white/50 text-xs">(最外层背景板)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={classicColors.baseplate}
                          onChange={(e) => {
                            console.log('修改经典背景板色:', e.target.value)
                            setClassicColors(prev => ({ ...prev, baseplate: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{classicColors.baseplate}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>背景色</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: classicColors.background }}></div>
                        <span className="text-white/50 text-xs">(主要棋盘区域)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={classicColors.background}
                          onChange={(e) => {
                            console.log('修改经典背景色:', e.target.value)
                            setClassicColors(prev => ({ ...prev, background: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{classicColors.background}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>边框色</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: classicColors.border }}></div>
                        <span className="text-white/50 text-xs">(最外层棕色边框)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={classicColors.border}
                          onChange={(e) => {
                            console.log('修改经典边框色:', e.target.value)
                            setClassicColors(prev => ({ ...prev, border: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{classicColors.border}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>线条色</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: classicColors.lines }}></div>
                        <span className="text-white/50 text-xs">(网格线和星点)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={classicColors.lines}
                          onChange={(e) => {
                            console.log('修改经典线条色:', e.target.value)
                            setClassicColors(prev => ({ ...prev, lines: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{classicColors.lines}</span>
                      </div>
                    </div>
                    
                    {/* 预设颜色方案 */}
                    <div className="mt-4 pt-3 border-t border-white/20">
                      <div className="text-xs text-white/80 mb-2">快速选色：</div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setClassicColors({ baseplate: '#654321', background: '#F4E4BC', border: '#8B4513', lines: '#8B4513' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#F4E4BC' }}
                          title="默认木色"
                        />
                        <button 
                          onClick={() => setClassicColors({ baseplate: '#8B4513', background: '#FFFACD', border: '#DAA520', lines: '#B8860B' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#FFFACD' }}
                          title="淡黄色"
                        />
                        <button 
                          onClick={() => setClassicColors({ baseplate: '#A0522D', background: '#FFF8DC', border: '#CD853F', lines: '#D2691E' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#FFF8DC' }}
                          title="米色"
                        />
                        <button 
                          onClick={() => setClassicColors({ baseplate: '#654321', background: '#F5F5DC', border: '#A0522D', lines: '#8B4513' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#F5F5DC' }}
                          title="米白色"
                        />
                        <button 
                          onClick={() => setClassicColors({ baseplate: '#CD853F', background: '#FFEFD5', border: '#FF8C00', lines: '#FF7F00' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#FFEFD5' }}
                          title="桃色"
                        />
                      </div>
                    </div>
                  </div>
                                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>背景板</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: vintageColors.baseplate }}></div>
                        <span className="text-white/50 text-xs">(最外层背景板)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={vintageColors.baseplate}
                          onChange={(e) => {
                            console.log('修改复古背景板色:', e.target.value)
                            setVintageColors(prev => ({ ...prev, baseplate: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{vintageColors.baseplate}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>木质背景</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: vintageColors.background }}></div>
                        <span className="text-white/50 text-xs">(主要棋盘区域)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={vintageColors.background}
                          onChange={(e) => {
                            console.log('修改复古背景色:', e.target.value)
                            setVintageColors(prev => ({ ...prev, background: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{vintageColors.background}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>木框色</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: vintageColors.border }}></div>
                        <span className="text-white/50 text-xs">(最外层木框)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={vintageColors.border}
                          onChange={(e) => {
                            console.log('修改复古框色:', e.target.value)
                            setVintageColors(prev => ({ ...prev, border: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{vintageColors.border}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-white text-xs flex items-center space-x-2">
                        <span>网格色</span>
                        <div className="w-4 h-4 rounded border border-white/30" style={{ backgroundColor: vintageColors.grid }}></div>
                        <span className="text-white/50 text-xs">(木纹纲理)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={vintageColors.grid}
                          onChange={(e) => {
                            console.log('修改复古网格色:', e.target.value)
                            setVintageColors(prev => ({ ...prev, grid: e.target.value }))
                          }}
                          className="w-8 h-6 rounded border-none cursor-pointer"
                        />
                        <span className="text-xs text-white/60 font-mono">{vintageColors.grid}</span>
                      </div>
                    </div>
                    
                    {/* 预设颜色方案 */}
                    <div className="mt-4 pt-3 border-t border-white/20">
                      <div className="text-xs text-white/80 mb-2">快速选色：</div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setVintageColors({ baseplate: '#4A3728', background: '#DEB887', border: '#654321', grid: '#8B4513' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#DEB887' }}
                          title="默认木色"
                        />
                        <button 
                          onClick={() => setVintageColors({ baseplate: '#2F2F2F', background: '#CD853F', border: '#8B4513', grid: '#654321' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#CD853F' }}
                          title="深木色"
                        />
                        <button 
                          onClick={() => setVintageColors({ baseplate: '#654321', background: '#D2691E', border: '#8B4513', grid: '#A0522D' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#D2691E' }}
                          title="巧克力色"
                        />
                        <button 
                          onClick={() => setVintageColors({ baseplate: '#5D4E37', background: '#BC8F8F', border: '#A0522D', grid: '#8B4513' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#BC8F8F' }}
                          title="灰褐色"
                        />
                        <button 
                          onClick={() => setVintageColors({ baseplate: '#8B4513', background: '#F4A460', border: '#CD853F', grid: '#D2691E' })}
                          className="w-6 h-6 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
                          style={{ backgroundColor: '#F4A460' }}
                          title="沙棕色"
                        />
                      </div>
                    </div>
                  </div>
                )}
              
              {/* 游戏控制 */}
              <div className="mt-6 flex justify-center space-x-4">
                {room.gameStatus === 'waiting' && canStartGame && (
                  <Button 
                    onClick={handleStartGame} 
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium px-8 py-3 rounded-xl shadow-lg transition-all"
                  >
                    开始游戏
                  </Button>
                )}
                
                {room.gameStatus === 'waiting' && !canStartGame && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-white/80 text-center font-medium">
                      {room.players.length < 2 ? '等待另一位玩家加入...' : '等待房主开始游戏...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 侧边栏 - 现代简洁风格 */}
          <div className="space-y-6">
            {/* 玩家信息 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>玩家 ({room.players.length}/2)</span>
                </h3>
              </div>
              <div className="space-y-3">
                {room.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl transition-all",
                      player.id === playerId 
                        ? "bg-blue-500/20 border border-blue-500/30" 
                        : "bg-white/10 border border-white/20"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      {index === 0 && <Crown className="h-4 w-4 text-yellow-400" />}
                      <User className="h-4 w-4 text-white/70" />
                      <span className="font-medium text-white">{player.name}</span>
                      {player.id === playerId && (
                        <span className="bg-blue-500/30 text-blue-200 px-2 py-1 rounded-full text-xs font-medium">你</span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {player.color && (
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2",
                            player.color === 'black' 
                              ? "bg-gradient-to-br from-gray-700 to-black border-gray-600" 
                              : "bg-gradient-to-br from-gray-100 to-white border-gray-400"
                          )}
                        />
                      )}
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        player.color === 'black' 
                          ? "bg-gray-800/50 text-white border border-gray-600" 
                          : player.color === 'white'
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      )}>
                        {player.color === 'black' ? '黑棋' : player.color === 'white' ? '白棋' : '观战'}
                      </span>
                    </div>
                  </div>
                ))}
                
                {room.players.length < 2 && (
                  <div className="text-center py-6 bg-white/5 rounded-xl border border-white/10">
                    <Users className="h-8 w-8 mx-auto mb-3 text-white/40" />
                    <p className="text-white/60 font-medium">等待玩家加入...</p>
                    <p className="text-white/40 text-sm mt-1">分享房间代码给朋友</p>
                  </div>
                )}
              </div>
            </div>

            {/* 游戏状态 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>游戏状态</span>
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white/10 rounded-xl p-3">
                  <span className="font-medium text-white/90">状态</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    room.gameStatus === 'playing' 
                      ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                    room.gameStatus === 'finished' 
                      ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                      : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                  )}>
                    {room.gameStatus === 'waiting' && '等待中'}
                    {room.gameStatus === 'playing' && '进行中'}
                    {room.gameStatus === 'finished' && '已结束'}
                  </span>
                </div>
                
                {room.gameStatus === 'playing' && currentPlayer && (
                  <div className="flex justify-between items-center bg-white/10 rounded-xl p-3">
                    <span className="font-medium text-white/90">轮到</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      room.currentPlayer === currentPlayer.color 
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                        : "bg-white/10 text-white/60 border border-white/20"
                    )}>
                      {room.currentPlayer === currentPlayer.color ? '你的回合' : '对方回合'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}