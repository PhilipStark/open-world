export type Position = { x: number; y: number }

export type Need = 'hunger' | 'safety' | 'social' | 'purpose'

export type ActionType =
  | 'move'
  | 'speak'
  | 'trade'
  | 'rest'
  | 'build'
  | 'attack'
  | 'gather'

export type TileType = 'grass' | 'water' | 'forest' | 'mountain' | 'desert' | 'settlement'

export interface Tile {
  x: number
  y: number
  type: TileType
  resources: Partial<Record<ResourceType, number>>
  agentIds: string[]
}

export type ResourceType = 'food' | 'wood' | 'stone' | 'water'

export interface AgentDecision {
  action: ActionType
  target?: string // agentId or position "x,y"
  speech?: string
  reasoning: string
}

export interface Agent {
  id: string
  worldId: string
  name: string
  personality: string
  position: Position
  needs: Record<Need, number> // 0–100, higher = more urgent
  memory: string[] // last 20 events
  relationships: Record<string, number> // agentId -> affinity (-100 to 100)
  inventory: Partial<Record<ResourceType, number>>
  alive: boolean
  age: number // ticks lived
  createdAt: string
}

export interface WorldEvent {
  id: string
  worldId: string
  tick: number
  type: string
  description: string
  involvedAgents: string[]
  createdAt: string
}

export interface WorldState {
  id: string
  name: string
  tick: number
  agents: Agent[]
  events: WorldEvent[]
  createdAt: string
  civState?: import('./civilization').CivState
}

export interface WorldConfig {
  mapSize: number
  maxAgents: number
  tickIntervalMs: number
  llmModel: string
}

export interface Perception {
  nearbyAgents: Array<{ id: string; name: string; distance: number; affinity: number }>
  nearbyResources: Array<{ type: ResourceType; amount: number; position: Position }>
  recentEvents: string[]
  currentTile: Tile
}
