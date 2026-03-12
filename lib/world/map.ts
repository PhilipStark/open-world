import { Tile, TileType, Position } from './types'

const TILE_TYPES: TileType[] = ['grass', 'forest', 'water', 'mountain', 'desert']

function weightedTile(x: number, y: number, size: number): TileType {
  // Simple noise-like distribution
  const nx = x / size
  const ny = y / size
  const val = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453
  const frac = val - Math.floor(val)

  if (frac < 0.45) return 'grass'
  if (frac < 0.65) return 'forest'
  if (frac < 0.75) return 'water'
  if (frac < 0.85) return 'mountain'
  return 'desert'
}

export function generateMap(size: number): Tile[][] {
  const map: Tile[][] = []
  for (let y = 0; y < size; y++) {
    map[y] = []
    for (let x = 0; x < size; x++) {
      const type = weightedTile(x, y, size)
      map[y][x] = {
        x,
        y,
        type,
        resources: tileResources(type),
        agentIds: [],
      }
    }
  }
  return map
}

function tileResources(type: TileType): Tile['resources'] {
  switch (type) {
    case 'grass':
      return { food: 5 }
    case 'forest':
      return { food: 3, wood: 8 }
    case 'water':
      return { water: 10, food: 2 }
    case 'mountain':
      return { stone: 10 }
    case 'desert':
      return { stone: 2 }
    case 'settlement':
      return { food: 2, wood: 2 }
    default:
      return {}
  }
}

export function getTile(map: Tile[][], pos: Position): Tile | null {
  if (pos.y < 0 || pos.y >= map.length) return null
  if (pos.x < 0 || pos.x >= map[0].length) return null
  return map[pos.y][pos.x]
}

export function getNeighborTiles(map: Tile[][], pos: Position, radius = 5): Tile[] {
  const tiles: Tile[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue
      const t = getTile(map, { x: pos.x + dx, y: pos.y + dy })
      if (t) tiles.push(t)
    }
  }
  return tiles
}

export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function randomWalkablePosition(map: Tile[][], size: number): Position {
  let pos: Position
  do {
    pos = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) }
  } while (map[pos.y][pos.x].type === 'water')
  return pos
}
