import { Agent, Tile, WorldState, AgentDecision, Perception, Position, Need } from './types'
import { agentDecide } from '../llm/client'
import { distance, getNeighborTiles, getTile } from './map'

const PERCEPTION_RADIUS = 5
const MEMORY_LIMIT = 20

export function buildPerception(agent: Agent, state: WorldState, map: Tile[][]): Perception {
  const nearbyTiles = getNeighborTiles(map, agent.position, PERCEPTION_RADIUS)

  const nearbyAgents = state.agents
    .filter((a) => a.id !== agent.id && a.alive)
    .map((a) => ({
      id: a.id,
      name: a.name,
      distance: distance(agent.position, a.position),
      affinity: agent.relationships[a.id] ?? 0,
    }))
    .filter((a) => a.distance <= PERCEPTION_RADIUS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)

  const resourceMap: Record<string, { type: any; amount: number; position: Position }> = {}
  for (const tile of nearbyTiles) {
    for (const [type, amount] of Object.entries(tile.resources)) {
      if (!amount) continue
      const key = `${type}`
      if (!resourceMap[key] || (resourceMap[key]?.amount ?? 0) < amount) {
        resourceMap[key] = { type, amount, position: { x: tile.x, y: tile.y } }
      }
    }
  }

  const currentTile = getTile(map, agent.position) ?? nearbyTiles[0]

  return {
    nearbyAgents,
    nearbyResources: Object.values(resourceMap),
    recentEvents: agent.memory.slice(-5),
    currentTile,
  }
}

export function buildDecisionPrompt(agent: Agent, perception: Perception, tick: number): string {
  const topNeeds = (Object.entries(agent.needs) as [Need, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v}/100`)
    .join(', ')

  const nearbyDesc =
    perception.nearbyAgents.length > 0
      ? perception.nearbyAgents
          .map((a) => `${a.name} (${Math.round(a.distance)} tiles, affinity: ${a.affinity})`)
          .join(', ')
      : 'nobody nearby'

  const resourceDesc =
    perception.nearbyResources.length > 0
      ? perception.nearbyResources.map((r) => `${r.type} at (${r.position.x},${r.position.y})`).join(', ')
      : 'no resources visible'

  return `You are ${agent.name}. Age: ${agent.age} ticks. Tick: ${tick}.
Personality: ${agent.personality}

Current needs (higher = more urgent): ${topNeeds}
Inventory: ${JSON.stringify(agent.inventory)}
Current tile: ${perception.currentTile?.type ?? 'unknown'} at (${agent.position.x},${agent.position.y})
Nearby agents: ${nearbyDesc}
Nearby resources: ${resourceDesc}
Recent memory: ${agent.memory.slice(-3).join(' | ') || 'nothing yet'}

Available actions: move, speak, trade, rest, gather, build, attack

Respond with JSON only:
{
  "action": "one of the available actions",
  "target": "agentName or 'x,y' position or null",
  "speech": "what you say out loud (or null)",
  "reasoning": "one sentence why"
}`
}

export async function processAgentTick(
  agent: Agent,
  state: WorldState,
  map: Tile[][]
): Promise<{ agent: Agent; decision: AgentDecision; event: string | null }> {
  const perception = buildPerception(agent, state, map)
  const prompt = buildDecisionPrompt(agent, perception, state.tick)
  const decision = await agentDecide(prompt)

  let updatedAgent = { ...agent }
  let event: string | null = null

  // Age the agent
  updatedAgent.age += 1

  // Increase needs over time
  updatedAgent.needs = {
    hunger: Math.min(100, agent.needs.hunger + 3),
    safety: Math.min(100, agent.needs.safety + 1),
    social: Math.min(100, agent.needs.social + 2),
    purpose: Math.min(100, agent.needs.purpose + 1),
  }

  // Process action
  switch (decision.action) {
    case 'move': {
      const target = parsePosition(decision.target)
      if (target) {
        const newPos: Position = {
          x: Math.max(0, Math.min(map[0].length - 1, agent.position.x + Math.sign(target.x - agent.position.x))),
          y: Math.max(0, Math.min(map.length - 1, agent.position.y + Math.sign(target.y - agent.position.y))),
        }
        updatedAgent.position = newPos
      }
      break
    }

    case 'gather': {
      const tile = getTile(map, agent.position)
      if (tile) {
        for (const [resource, amount] of Object.entries(tile.resources)) {
          if (amount && amount > 0) {
            const inv = updatedAgent.inventory as Record<string, number>
            inv[resource] = (inv[resource] ?? 0) + 1
            if (resource === 'food') updatedAgent.needs.hunger = Math.max(0, updatedAgent.needs.hunger - 20)
            break
          }
        }
      }
      break
    }

    case 'speak': {
      if (decision.speech && perception.nearbyAgents.length > 0) {
        event = `${agent.name} says: "${decision.speech}"`
        // Improve social need
        updatedAgent.needs.social = Math.max(0, updatedAgent.needs.social - 15)
        // Update relationships
        for (const nearby of perception.nearbyAgents) {
          updatedAgent.relationships[nearby.id] = Math.min(100, (agent.relationships[nearby.id] ?? 0) + 3)
        }
      }
      break
    }

    case 'rest': {
      updatedAgent.needs.safety = Math.max(0, updatedAgent.needs.safety - 20)
      updatedAgent.needs.purpose = Math.max(0, updatedAgent.needs.purpose - 5)
      break
    }

    case 'trade': {
      const targetAgent = perception.nearbyAgents.find((a) => a.name === decision.target)
      if (targetAgent) {
        event = `${agent.name} offers to trade with ${targetAgent.name}`
        updatedAgent.relationships[targetAgent.id] = Math.min(100, (agent.relationships[targetAgent.id] ?? 0) + 5)
        updatedAgent.needs.social = Math.max(0, updatedAgent.needs.social - 10)
      }
      break
    }

    case 'attack': {
      const targetAgent = perception.nearbyAgents.find((a) => a.name === decision.target)
      if (targetAgent) {
        event = `⚔️ ${agent.name} attacks ${targetAgent.name}!`
        updatedAgent.relationships[targetAgent.id] = Math.max(-100, (agent.relationships[targetAgent.id] ?? 0) - 20)
        updatedAgent.needs.safety = Math.max(0, updatedAgent.needs.safety - 10)
      }
      break
    }
  }

  // Log to memory
  const memEntry = `[T${state.tick}] ${decision.action}${decision.target ? ` → ${decision.target}` : ''}${decision.speech ? `: "${decision.speech}"` : ''}`
  updatedAgent.memory = [...agent.memory.slice(-(MEMORY_LIMIT - 1)), memEntry]

  // Die if hunger is maxed out for too long
  if (updatedAgent.needs.hunger >= 100 && updatedAgent.age > 10) {
    updatedAgent.alive = false
    event = `💀 ${agent.name} has died of hunger at age ${updatedAgent.age}`
  }

  return { agent: updatedAgent, decision, event }
}

function parsePosition(target: string | undefined): Position | null {
  if (!target) return null
  const parts = target.split(',').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { x: parts[0], y: parts[1] }
  }
  return null
}
