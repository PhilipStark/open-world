import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { runWorldTick } from '@/lib/world/engine'
import { WorldState, Tile, Agent } from '@/lib/world/types'

export async function POST(req: Request) {
  try {
    const { worldId } = await req.json()
    if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 })

    const db = createServerClient()

    // Load world
    const { data: world, error: worldErr } = await db
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .single()

    if (worldErr || !world) {
      return NextResponse.json({ error: 'World not found' }, { status: 404 })
    }

    // Load agents
    const { data: agentsData } = await db
      .from('agents')
      .select('*')
      .eq('world_id', worldId)

    const agents: Agent[] = (agentsData ?? []).map((a: any) => ({
      ...a,
      worldId: a.world_id,
      position: a.position,
      needs: a.needs,
      memory: a.memory,
      relationships: a.relationships,
      inventory: a.inventory,
      createdAt: a.created_at,
    }))

    const state: WorldState = {
      id: world.id,
      name: world.name,
      tick: world.tick,
      agents,
      events: [],
      createdAt: world.created_at,
      civState: world.civ_state ?? undefined,
    }

    const map: Tile[][] = world.map as Tile[][]

    // Run tick
    const { newState, newEvents } = await runWorldTick(state, map)

    // Persist updated agents
    for (const agent of newState.agents) {
      await db.from('agents').upsert({
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
      })
    }

    // Persist new events
    if (newEvents.length > 0) {
      await db.from('world_events').insert(
        newEvents.map((e) => ({
          id: e.id,
          world_id: e.worldId,
          tick: e.tick,
          type: e.type,
          description: e.description,
          involved_agents: e.involvedAgents,
        }))
      )
    }

    // Update world tick + civ state
    await db.from('worlds').update({
      tick: newState.tick,
      civ_state: newState.civState ?? {},
    }).eq('id', worldId)

    return NextResponse.json({
      tick: newState.tick,
      agentsAlive: newState.agents.filter((a) => a.alive).length,
      newEvents: newEvents.length,
    })
  } catch (err) {
    console.error('[tick] Error:', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}
