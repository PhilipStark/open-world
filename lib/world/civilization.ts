/**
 * Civilization engine — tracks world stage, milestones, groups, and births
 */

import { Agent, WorldState, WorldEvent } from './types'

export type CivStage =
  | 'primitive'    // tick 0-100: survival, hunting, wandering
  | 'tribal'       // 100-500: groups, territory, first conflicts
  | 'sedentary'    // 500-2000: shelters, farming, surplus
  | 'commercial'   // 2000-5000: trade, specialization, markets
  | 'political'    // 5000-15000: laws, elections, diplomacy
  | 'cultural'     // 15000+: religion, science, art

export interface CivState {
  stage: CivStage
  stageSince: number
  milestones: Milestone[]
  groups: Group[]
  structures: Structure[]
  population: number
  totalBorn: number
  totalDead: number
  historyLog: string[] // short summaries for new agent memory
}

export interface Milestone {
  id: string
  tick: number
  type: string
  description: string
  agents: string[]
}

export interface Group {
  id: string
  name: string
  leaderId: string
  memberIds: string[]
  territory: { x: number; y: number }
  color: string
  formedAt: number
}

export interface Structure {
  id: string
  type: 'shelter' | 'farm' | 'market' | 'temple' | 'fort'
  position: { x: number; y: number }
  builtBy: string
  tick: number
  name?: string
}

const STAGE_THRESHOLDS: Record<CivStage, number> = {
  primitive:  0,
  tribal:     100,
  sedentary:  500,
  commercial: 2000,
  political:  5000,
  cultural:   15000,
}

export function computeStage(tick: number): CivStage {
  const stages = Object.entries(STAGE_THRESHOLDS) as [CivStage, number][]
  let current: CivStage = 'primitive'
  for (const [stage, threshold] of stages) {
    if (tick >= threshold) current = stage
  }
  return current
}

export function stageDescription(stage: CivStage): string {
  const desc: Record<CivStage, string> = {
    primitive:  'The world is raw. Agents hunt, gather, and survive. No rules. No names for things yet.',
    tribal:     'Groups are forming around strong individuals. Territory is being claimed. The first conflicts are emerging.',
    sedentary:  'Permanent shelters dot the landscape. Food is being grown. Agents are starting to specialize.',
    commercial: 'Trade routes connect settlements. Markets are forming. Some agents accumulate more than others.',
    political:  'Laws are being written. Leaders are elected. Alliances and betrayals shape the world.',
    cultural:   'Religion, art, and science emerge. The dead are remembered. Something bigger than survival is taking shape.',
  }
  return desc[stage]
}

export function buildAgentSystemPrompt(agent: Agent, civState: CivState, tick: number): string {
  const stage = civState.stage
  const stageDesc = stageDescription(stage)
  const group = civState.groups.find(g => g.memberIds.includes(agent.id))
  const recentMilestones = civState.milestones.slice(-3).map(m => m.description).join('; ')

  return `You are ${agent.name}, a being living in a world called Open World.

WORLD STATE (Tick ${tick}, Stage: ${stage.toUpperCase()})
${stageDesc}
${recentMilestones ? `Recent world events: ${recentMilestones}` : ''}
${group ? `You belong to group "${group.name}", led by ${civState.groups.find(g=>g.id===group.id) ? agent.name : 'unknown'}.` : 'You are unaffiliated with any group.'}
Population: ${civState.population} agents alive.

YOUR NATURE
${agent.personality}
You have been alive for ${agent.age} ticks. ${agent.age < 10 ? 'You are newly born into this world.' : agent.age > 500 ? 'You are an elder who has seen much.' : ''}

STAGE GUIDANCE
${stageGuidance(stage)}

Respond ONLY with valid JSON — no markdown:
{"action":"move|speak|trade|gather|rest|build|attack|form_group|join_group","target":"name or x,y or null","speech":"optional","reasoning":"one sentence"}`
}

function stageGuidance(stage: CivStage): string {
  switch (stage) {
    case 'primitive':
      return 'Focus on survival: find food, stay safe, explore. Social bonds are just forming — be cautious with strangers but curious.'
    case 'tribal':
      return 'Groups are forming. Consider allying with others or asserting leadership. Territory matters. Rivals may need to be confronted or avoided.'
    case 'sedentary':
      return 'Think beyond survival. Build shelter. Plant near water. Specialize. Trade surplus resources. The market is the center of civilization.'
    case 'commercial':
      return 'Wealth matters now. Trade aggressively. Accumulate. Specialize your role. Political influence follows economic power.'
    case 'political':
      return 'Power structures are everything. Align with the right leader. Write or enforce laws. Diplomacy can achieve what force cannot.'
    case 'cultural':
      return 'You carry the weight of history. Honor the ancestors. Teach, create, discover. Your legacy outlasts your body.'
  }
}

export function detectMilestones(
  prevState: WorldState,
  newState: WorldState,
  civState: CivState,
  newEvents: WorldEvent[]
): Milestone[] {
  const milestones: Milestone[] = []
  const existing = new Set(civState.milestones.map(m => m.type))

  // First speech
  if (!existing.has('first_speech')) {
    const speech = newEvents.find(e => e.type === 'speech')
    if (speech) milestones.push({
      id: `ms-${Date.now()}`, tick: newState.tick,
      type: 'first_speech',
      description: '🗣️ First words spoken in human history.',
      agents: speech.involvedAgents,
    })
  }

  // First meeting
  if (!existing.has('first_meeting')) {
    const meet = newEvents.find(e => e.type === 'meeting')
    if (meet) milestones.push({
      id: `ms-${Date.now()+1}`, tick: newState.tick,
      type: 'first_meeting',
      description: '👋 Two beings meet for the first time.',
      agents: meet.involvedAgents,
    })
  }

  // First trade
  if (!existing.has('first_trade')) {
    const trade = newEvents.find(e => e.type === 'trade')
    if (trade) milestones.push({
      id: `ms-${Date.now()+2}`, tick: newState.tick,
      type: 'first_trade',
      description: '🤝 First trade in world history.',
      agents: trade.involvedAgents,
    })
  }

  // First death
  if (!existing.has('first_death')) {
    const dead = newState.agents.find(a => !a.alive && prevState.agents.find(p => p.id === a.id)?.alive)
    if (dead) milestones.push({
      id: `ms-${Date.now()+3}`, tick: newState.tick,
      type: 'first_death',
      description: `💀 ${dead.name} becomes the first to die. Age: ${dead.age}.`,
      agents: [dead.id],
    })
  }

  // First attack
  if (!existing.has('first_combat')) {
    const combat = newEvents.find(e => e.type === 'combat')
    if (combat) milestones.push({
      id: `ms-${Date.now()+4}`, tick: newState.tick,
      type: 'first_combat',
      description: '⚔️ First act of violence. The world is no longer innocent.',
      agents: combat.involvedAgents,
    })
  }

  // Population milestones
  const pop = newState.agents.filter(a => a.alive).length
  for (const n of [10, 25, 50, 100]) {
    if (!existing.has(`pop_${n}`) && pop >= n) {
      milestones.push({
        id: `ms-pop-${n}`, tick: newState.tick,
        type: `pop_${n}`,
        description: `👥 World population reaches ${n}.`,
        agents: [],
      })
    }
  }

  return milestones
}

export function shouldBeBorn(agents: Agent[], tick: number): boolean {
  const alive = agents.filter(a => a.alive).length
  // Birth rate: one new agent every ~20 ticks if pop < 20, slowing as pop grows
  if (alive >= 50) return false
  const baseRate = Math.max(5, 20 - Math.floor(alive / 2))
  return tick % baseRate === 0
}

export function createOffspring(parents: [Agent, Agent], tick: number, worldId: string): Agent {
  // Mix personality traits
  const traits = [
    parents[0].personality.split('.')[0],
    parents[1].personality.split('.')[0],
  ]
  const names = ['Arlo', 'Mira', 'Soren', 'Lena', 'Cael', 'Nora', 'Riven', 'Sable',
                  'Finn', 'Lyra', 'Oryn', 'Vela', 'Idris', 'Zara', 'Cleo', 'Theo']
  const usedNames = new Set([parents[0].name, parents[1].name])
  const name = names.find(n => !usedNames.has(n)) ?? `Agent${tick}`

  const inheritedMemory = [
    `[Born T${tick}] Offspring of ${parents[0].name} and ${parents[1].name}.`,
    ...parents[0].memory.slice(-2),
    ...parents[1].memory.slice(-2),
  ]

  return {
    id: `agent-${name.toLowerCase()}-${tick}`,
    worldId,
    name,
    personality: `${traits.join('. ')}. Born of ${parents[0].name} and ${parents[1].name}, carrying their legacy.`,
    position: { ...parents[0].position },
    needs: { hunger: 40, safety: 40, social: 20, purpose: 60 },
    memory: inheritedMemory,
    relationships: {
      [parents[0].id]: 80,
      [parents[1].id]: 80,
    },
    inventory: {},
    alive: true,
    age: 0,
    createdAt: new Date().toISOString(),
  }
}
