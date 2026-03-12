import { WorldState, WorldEvent, Tile, Agent } from './types'
import { processAgentTick } from './agent'
import { generateMap } from './map'
import {
  CivState, computeStage, detectMilestones, shouldBeBorn, createOffspring
} from './civilization'

function defaultCivState(): CivState {
  return {
    stage: 'primitive',
    stageSince: 0,
    milestones: [],
    groups: [],
    structures: [],
    population: 0,
    totalBorn: 0,
    totalDead: 0,
    historyLog: [],
  }
}

export async function runWorldTick(
  state: WorldState,
  map: Tile[][]
): Promise<{ newState: WorldState; newEvents: WorldEvent[] }> {
  const civState: CivState = state.civState ?? defaultCivState()
  const alive = state.agents.filter(a => a.alive)

  console.log(`[Engine] Tick ${state.tick + 1} | Stage: ${civState.stage} | Pop: ${alive.length}`)

  // Process all living agents in parallel batches
  const BATCH = 5
  const results: Array<{ agent: Agent; event: string | null }> = []

  for (let i = 0; i < alive.length; i += BATCH) {
    const batch = alive.slice(i, i + BATCH)
    const batchResults = await Promise.all(
      batch.map(agent => processAgentTick(agent, state, map, civState))
    )
    results.push(...batchResults.map(r => ({ agent: r.agent, event: r.event })))
  }

  // Update agent map
  const agentMap = new Map(state.agents.map(a => [a.id, a]))
  for (const { agent } of results) agentMap.set(agent.id, agent)

  // Collect events
  const newEvents: WorldEvent[] = results
    .filter(r => r.event)
    .map((r, i) => ({
      id: `evt-${state.tick + 1}-${i}`,
      worldId: state.id,
      tick: state.tick + 1,
      type: classifyEvent(r.event!),
      description: r.event!,
      involvedAgents: [],
      createdAt: new Date().toISOString(),
    }))

  // First-meeting events
  const agentList = Array.from(agentMap.values())
  for (let i = 0; i < agentList.length; i++) {
    for (let j = i + 1; j < agentList.length; j++) {
      const a = agentList[i], b = agentList[j]
      if (!a.alive || !b.alive) continue
      const dist = Math.sqrt((a.position.x - b.position.x) ** 2 + (a.position.y - b.position.y) ** 2)
      const prevA = state.agents.find(x => x.id === a.id)
      if (dist <= 1.5 && !(b.id in (prevA?.relationships ?? {}))) {
        newEvents.push({
          id: `evt-meet-${state.tick + 1}-${i}-${j}`,
          worldId: state.id,
          tick: state.tick + 1,
          type: 'meeting',
          description: `👋 ${a.name} and ${b.name} meet for the first time`,
          involvedAgents: [a.id, b.id],
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  // Build new state
  const newState: WorldState = {
    ...state,
    tick: state.tick + 1,
    agents: Array.from(agentMap.values()),
    events: [...state.events.slice(-50), ...newEvents],
  }

  // Detect milestones
  const newMilestones = detectMilestones(state, newState, civState, newEvents)
  for (const ms of newMilestones) {
    newEvents.push({
      id: `evt-ms-${ms.id}`,
      worldId: state.id,
      tick: state.tick + 1,
      type: 'milestone',
      description: `🏛️ MILESTONE: ${ms.description}`,
      involvedAgents: ms.agents,
      createdAt: new Date().toISOString(),
    })
  }

  // Birth system
  const aliveAfter = newState.agents.filter(a => a.alive)
  if (shouldBeBorn(newState.agents, newState.tick)) {
    const candidates = aliveAfter.filter(a => a.age > 5)
    if (candidates.length >= 2) {
      // Find pair with highest mutual affinity
      let bestPair: [Agent, Agent] | null = null
      let bestScore = -Infinity
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i], b = candidates[j]
          const score = (a.relationships[b.id] ?? 0) + (b.relationships[a.id] ?? 0)
          if (score > bestScore && score > 30) { bestScore = score; bestPair = [a, b] }
        }
      }
      if (bestPair) {
        const child = createOffspring(bestPair, newState.tick, state.id)
        newState.agents = [...newState.agents, child]
        newEvents.push({
          id: `evt-birth-${newState.tick}`,
          worldId: state.id,
          tick: newState.tick,
          type: 'birth',
          description: `🌱 ${child.name} is born — child of ${bestPair[0].name} and ${bestPair[1].name}.`,
          involvedAgents: [child.id, bestPair[0].id, bestPair[1].id],
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  // Update civilization state
  const newStage = computeStage(newState.tick)
  const prevStage = civState.stage
  const updatedCivState: CivState = {
    ...civState,
    stage: newStage,
    stageSince: newStage !== prevStage ? newState.tick : civState.stageSince,
    milestones: [...civState.milestones, ...newMilestones],
    population: newState.agents.filter(a => a.alive).length,
    totalBorn: civState.totalBorn + (newState.agents.length - state.agents.length),
    totalDead: civState.totalDead + newState.agents.filter(a => !a.alive).length - state.agents.filter(a => !a.alive).length,
    historyLog: [
      ...civState.historyLog.slice(-20),
      ...newMilestones.map(m => m.description),
    ],
  }

  // Stage transition announcement
  if (newStage !== prevStage) {
    newEvents.push({
      id: `evt-stage-${newState.tick}`,
      worldId: state.id,
      tick: newState.tick,
      type: 'stage',
      description: `⚡ ERA SHIFT: The world enters the ${newStage.toUpperCase()} age.`,
      involvedAgents: [],
      createdAt: new Date().toISOString(),
    })
  }

  newState.civState = updatedCivState

  return { newState, newEvents }
}

function classifyEvent(description: string): string {
  if (description.includes('says:')) return 'speech'
  if (description.includes('attacks') || description.includes('⚔️')) return 'combat'
  if (description.includes('trade')) return 'trade'
  if (description.includes('died') || description.includes('💀')) return 'death'
  if (description.includes('born') || description.includes('🌱')) return 'birth'
  if (description.includes('meet') || description.includes('👋')) return 'meeting'
  if (description.includes('MILESTONE')) return 'milestone'
  if (description.includes('ERA SHIFT')) return 'stage'
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
    civState: defaultCivState(),
  }
  return { state, map }
}
