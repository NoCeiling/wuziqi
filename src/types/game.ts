// 游戏状态类型
export type GameStatus = 'waiting' | 'playing' | 'finished'

// 棋子类型
export type Player = 'black' | 'white'

// 棋盘位置
export interface Position {
  row: number
  col: number
}

// 棋子信息
export interface Piece {
  player: Player
  position: Position
}

// 玩家信息
export interface PlayerInfo {
  id: string
  name: string
  color: Player | null
  ready: boolean
}

// 房间信息
export interface Room {
  id: string
  code: string
  players: PlayerInfo[]
  gameStatus: GameStatus
  board: (Player | null)[][]
  currentPlayer: Player
  winner: Player | null
  createdAt: Date
}

// Socket 事件类型
export interface ServerToClientEvents {
  'room-joined': (room: Room) => void
  'room-error': (error: string) => void
  'player-joined': (player: PlayerInfo) => void
  'player-left': (playerId: string) => void
  'game-started': () => void
  'move-made': (position: Position, player: Player) => void
  'game-over': (winner: Player | null) => void
  'room-updated': (room: Room) => void
}

export interface ClientToServerEvents {
  'create-room': (playerName: string) => void
  'join-room': (code: string, playerName: string) => void
  'leave-room': () => void
  'make-move': (position: Position) => void
  'start-game': () => void
}