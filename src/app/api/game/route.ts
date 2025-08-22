import { NextRequest, NextResponse } from 'next/server'
import type { Room, PlayerInfo, Position, Player } from '@/types/game'
import { generateRoomId, generateInviteCode } from '@/lib/utils'

// 使用全局变量来存储游戏数据（注意：在生产环境中应该使用数据库）
declare global {
  var gameRooms: Map<string, Room> | undefined
  var playerRooms: Map<string, string> | undefined
}

// 初始化全局存储
if (!globalThis.gameRooms) {
  globalThis.gameRooms = new Map()
}
if (!globalThis.playerRooms) {
  globalThis.playerRooms = new Map()
}

const rooms = globalThis.gameRooms
const playerRooms = globalThis.playerRooms

// 初始化空棋盘
function createEmptyBoard(): (Player | null)[][] {
  return Array(15).fill(null).map(() => Array(15).fill(null))
}

// 检查是否获胜
function checkWin(board: (Player | null)[][], lastMove: Position, player: Player): boolean {
  const directions = [
    [0, 1],   // 水平
    [1, 0],   // 垂直
    [1, 1],   // 对角线
    [1, -1]   // 反对角线
  ]

  for (const [dx, dy] of directions) {
    let count = 1
    
    // 正向检查
    for (let i = 1; i < 5; i++) {
      const row = lastMove.row + dx * i
      const col = lastMove.col + dy * i
      if (row < 0 || row >= 15 || col < 0 || col >= 15 || board[row][col] !== player) {
        break
      }
      count++
    }
    
    // 反向检查
    for (let i = 1; i < 5; i++) {
      const row = lastMove.row - dx * i
      const col = lastMove.col - dy * i
      if (row < 0 || row >= 15 || col < 0 || col >= 15 || board[row][col] !== player) {
        break
      }
      count++
    }
    
    if (count >= 5) {
      return true
    }
  }
  
  return false
}

// 创建房间
export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json()
    
    switch (action) {
      case 'create-room': {
        const { playerName, playerId } = data
        const roomCode = generateInviteCode()
        const roomId = generateRoomId()
        
        const player: PlayerInfo = {
          id: playerId,
          name: playerName,
          color: 'black',
          ready: true
        }
        
        const room: Room = {
          id: roomId,
          code: roomCode,
          players: [player],
          gameStatus: 'waiting',
          board: createEmptyBoard(),
          currentPlayer: 'black',
          winner: null,
          createdAt: new Date()
        }
        
        rooms.set(roomCode, room)
        playerRooms.set(playerId, roomCode)
        
        return NextResponse.json({ success: true, room })
      }
      
      case 'join-room': {
        const { code, playerName, playerId } = data
        const room = rooms.get(code)
        
        if (!room) {
          return NextResponse.json({ success: false, error: '房间不存在' })
        }
        
        if (room.players.length >= 2) {
          return NextResponse.json({ success: false, error: '房间已满' })
        }
        
        if (room.gameStatus !== 'waiting') {
          return NextResponse.json({ success: false, error: '游戏已开始' })
        }
        
        const player: PlayerInfo = {
          id: playerId,
          name: playerName,
          color: 'white',
          ready: true
        }
        
        room.players.push(player)
        playerRooms.set(playerId, code)
        
        return NextResponse.json({ success: true, room })
      }
      
      case 'start-game': {
        const { playerId } = data
        const roomCode = playerRooms.get(playerId)
        
        if (!roomCode) {
          return NextResponse.json({ success: false, error: '未找到房间' })
        }
        
        const room = rooms.get(roomCode)
        if (!room) {
          return NextResponse.json({ success: false, error: '房间不存在' })
        }
        
        if (room.players[0]?.id !== playerId) {
          return NextResponse.json({ success: false, error: '只有房主可以开始游戏' })
        }
        
        if (room.players.length !== 2) {
          return NextResponse.json({ success: false, error: '需要两名玩家才能开始游戏' })
        }
        
        room.gameStatus = 'playing'
        room.board = createEmptyBoard()
        room.currentPlayer = 'black'
        room.winner = null
        
        return NextResponse.json({ success: true, room })
      }
      
      case 'make-move': {
        const { playerId, position } = data
        const roomCode = playerRooms.get(playerId)
        
        if (!roomCode) {
          return NextResponse.json({ success: false, error: '未找到房间' })
        }
        
        const room = rooms.get(roomCode)
        if (!room || room.gameStatus !== 'playing') {
          return NextResponse.json({ success: false, error: '游戏未进行中' })
        }
        
        const player = room.players.find(p => p.id === playerId)
        if (!player || player.color !== room.currentPlayer) {
          return NextResponse.json({ success: false, error: '不是您的回合' })
        }
        
        if (position.row < 0 || position.row >= 15 || position.col < 0 || position.col >= 15) {
          return NextResponse.json({ success: false, error: '无效位置' })
        }
        
        if (room.board[position.row][position.col] !== null) {
          return NextResponse.json({ success: false, error: '该位置已有棋子' })
        }
        
        room.board[position.row][position.col] = player.color
        
        const isWin = checkWin(room.board, position, player.color)
        
        if (isWin) {
          room.gameStatus = 'finished'
          room.winner = player.color
        } else {
          room.currentPlayer = room.currentPlayer === 'black' ? 'white' : 'black'
        }
        
        return NextResponse.json({ success: true, room })
      }
      
      case 'leave-room': {
        const { playerId } = data
        const roomCode = playerRooms.get(playerId)
        
        if (!roomCode) {
          return NextResponse.json({ success: false, error: '未找到房间' })
        }
        
        const room = rooms.get(roomCode)
        if (!room) {
          return NextResponse.json({ success: false, error: '房间不存在' })
        }
        
        room.players = room.players.filter(p => p.id !== playerId)
        playerRooms.delete(playerId)
        
        if (room.players.length === 0) {
          rooms.delete(roomCode)
        } else if (room.gameStatus === 'playing') {
          room.gameStatus = 'finished'
        }
        
        return NextResponse.json({ success: true, room })
      }
      
      default:
        return NextResponse.json({ success: false, error: '未知操作' })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' })
  }
}

// 获取房间状态
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const playerId = url.searchParams.get('playerId')
    
    if (code) {
      const room = rooms.get(code)
      if (!room) {
        return NextResponse.json({ success: false, error: '房间不存在' })
      }
      return NextResponse.json({ success: true, room })
    }
    
    if (playerId) {
      const roomCode = playerRooms.get(playerId)
      if (!roomCode) {
        return NextResponse.json({ success: false, error: '未找到房间' })
      }
      
      const room = rooms.get(roomCode)
      if (!room) {
        return NextResponse.json({ success: false, error: '房间不存在' })
      }
      
      return NextResponse.json({ success: true, room })
    }
    
    return NextResponse.json({ success: false, error: '缺少参数' })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' })
  }
}