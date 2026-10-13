export type BoardRow = { score: number; ciUp: number; ciDown: number; votes: number; preliminary: boolean }
export type ArenaBoard = {
  key: string
  source: string
  url: string
  leaderboardUpdated: string | null
  totalVotes: number | null
  fetchedAt: string
  poolSpan: number
  /** 以下三项由 AI 日报编辑的数据补上前可能缺；缺了这个榜不出招（boards.ts 校验） */
  unit?: string
  higherIsBetter?: boolean
  category?: string
  models: Record<string, BoardRow>
}
export type Avatar = 'knight' | 'dragon' | 'mage' | 'mech' | 'whale' | 'scholar' | 'rabbit' | 'fox'
  | 'meta' | 'mistral' | 'bytedance' | 'tencent' | 'nvidia' | 'minimax' | 'amazon' | 'microsoft' | 'cohere' | 'stepfun' | 'baidu' | 'xiaomi' | 'mystery'
export type ArenaVendor = { id: string; name: string; avatar: Avatar; color: string; count: number }
export type ArenaModel = {
  id: string
  label: string
  /** base avatar id */
  avatar: Avatar
  boards: string[]
  vendor?: string
  /** composite = mean percentile over the boards it appears on */
  comp?: number
  isNew?: boolean
}
export type ArenaData = {
  version: number
  date: string
  updatedAt: string
  featured: { left: string; right: string; reason?: string }
  models: Record<string, ArenaModel>
  boards: ArenaBoard[]
  vendors?: Record<string, ArenaVendor>
}
export type Side = 'left' | 'right'
export type RoundResult = {
  board: ArenaBoard
  left: BoardRow
  right: BoardRow
  attacker: Side
  delta: number
  threshold: number
  kind: 'block' | 'hit' | 'crit'
  damage: number
  /** attacker was behind on HP when landing this hit */
  counter: boolean
  hpAfter: { left: number; right: number }
}
export type BattleResult = {
  left: ArenaModel
  right: ArenaModel
  rounds: RoundResult[]
  winner: Side | null
}
