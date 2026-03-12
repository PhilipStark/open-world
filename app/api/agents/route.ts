import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { Agent } from '@/lib/world/types'
import { randomWalkablePosition } from '@/lib/world/map'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const worldId = searchParams.get('worldId')
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 })

  const db = createServerClient()
  const { data } = await db.from('agents').select('*').eq('world_id', worldId).order('name')
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { worldId, name, personality } = body

  if (!worldId || !name || !personality) {
    return NextResponse.json({ error: 'worldId, name, personality required' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: world } = await db.from('worlds').select('map, map_size').eq('id', worldId).single()
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

  const map = world.map as any[][]
  const position = randomWalkablePosition(map as any, world.map_size)

  const agent: Omit<Agent, 'createdAt'> = {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    worldId,
    name,
    personality,
    position,
    needs: { hunger: 20, safety: 20, social: 30, purpose: 40 },
    memory: [],
    relationships: {},
    inventory: {},
    alive: true,
    age: 0,
  }

  const { data, error } = await db.from('agents').insert({
    id: agent.id,
    world_id: agent.worldId,
    name: agent.name,
    personality: agent.personality,
    position: agent.position,
    needs: agent.needs,
    memory: agent.memory,
    relationships: agent.relationships,
    inventory: agent.inventory,
    alive: agent.alive,
    age: agent.age,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
