import { WorldState, WorldEvent, Tile, Agent } from './types'
import { processAgentTick } from './agent'
import { generateMap } from './map'

export async function runWorldTick(state: WorldState, map: Tile[][]): Promise<{
  newState: WorldState
  newEvents: WorldEvent[]
}> {
  console.log(`[Engine] Tick ${state.tick + 1} — ${state.agents.filter((a) => a.alive).length} agents alive`)

  // Process all living agents in parallel (batched to avoid LLM rate limits)
  const livingAgents = state.agents.filter((a) => a.alive)
  const BATCH_SIZE = 5
  const results: Array<{ agent: Agent; event: string | null }> = []

  for (let i = 0; i < livingAgents.length; i += BATCH_SIZE) {
    const batch = livingAgents.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((agent) => processAgentTick(agent, state, map))
    )
    results.push(...batchResults.map((r) => ({ agent: r.agent, event: r.event })))
  }

  // Build updated agent map
  const agentMap = new Map(state.agents.map((a) => [a.id, a]))
  for (const { agent } of results) {
    agentMap.set(agent.id, agent)
  }

  // Collect events
  const newEvents: WorldEvent[] = results
    .filter((r) => r.event)
    .map((r, i) => ({
      id: `evt-${state.tick + 1}-${i}`,
      worldId: state.id,
      tick: state.tick + 1,
      type: classifyEvent(r.event!),
      description: r.event!,
      involvedAgents: [],
      createdAt: new Date().toISOString(),
    }))

  // Detect first-meeting events
  const agentList = Array.from(agentMap.values())
  for (let i = 0; i < agentList.length; i++) {
    for (let j = i + 1; j < agentList.length; j++) {
      const a = agentList[i]
      const b = agentList[j]
      if (!a.alive || !b.alive) continue
      const dist = Math.sqrt((a.position.x - b.position.x) ** 2 + (a.position.y - b.position.y) ** 2)
      // First time within 1 tile of each other
      if (dist <= 1.5 && !(a.id in (state.agents.find((x) => x.id === b.id)?.relationships ?? {}))) {
        newEvents.push({
          id: `evt-meet-${state.tick + 1}-${i}-${j}`,
          worldId: state.id,
          tick: state.tick + 1,
          type: 'meeting',
          description: `🤝 ${a.name} and ${b.name} meet for the first time`,
          involvedAgents: [a.id, b.id],
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  const newState: WorldState = {
    ...state,
    tick: state.tick + 1,
    agents: Array.from(agentMap.values()),
    events: [...state.events.slice(-50), ...newEvents], // keep last 50 events in state
  }

  return { newState, newEvents }
}

function classifyEvent(description: string): string {
  if (description.includes('says:')) return 'speech'
  if (description.includes('attacks')) return 'combat'
  if (description.includes('trade')) return 'trade'
  if (description.includes('died')) return 'death'
  if (description.includes('meet')) return 'meeting'
  return 'action'
}

export function createWorld(name: string, mapSize: number): { state: WorldState; map: Tile[][] } {
  const map = generateMap(mapSize)
  const state: WorldState = {
    id: `world-${Date.now()}`,
    name,
    tick: 0,
    agents: [],
    events: [],
    createdAt: new Date().toISOString(),
  }
  return { state, map }
}
