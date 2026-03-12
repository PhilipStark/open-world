/**
 * Webhook dispatcher — sends tick events to connected OpenClaw instances
 * and collects their decisions.
 */

import { Agent, AgentDecision, Perception, WorldState, Tile } from './types'
import { buildPerception, buildDecisionPrompt } from './agent'
import { agentDecide } from '../llm/client'
import crypto from 'crypto'

export interface AgentConnection {
  agentId: string
  webhookUrl: string
  webhookSecret?: string
  token: string
}

/**
 * Call an external OpenClaw webhook for an agent decision.
 * Falls back to local LLM if webhook fails or times out.
 */
export async function fetchWebhookDecision(
  agent: Agent,
  perception: Perception,
  state: WorldState,
  connection: AgentConnection
): Promise<AgentDecision> {
  const payload = {
    event: 'tick',
    agentId: agent.id,
    agentName: agent.name,
    tick: state.tick,
    perception: {
      nearbyAgents: perception.nearbyAgents,
      nearbyResources: perception.nearbyResources,
      recentEvents: perception.recentEvents,
      currentTile: perception.currentTile?.type,
      position: agent.position,
    },
    needs: agent.needs,
    inventory: agent.inventory,
    memory: agent.memory.slice(-5),
    token: connection.token,
  }

  const body = JSON.stringify(payload)

  // HMAC signature if secret provided
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-OpenWorld-Agent': agent.id,
    'X-OpenWorld-Tick': String(state.tick),
  }

  if (connection.webhookSecret) {
    const sig = crypto.createHmac('sha256', connection.webhookSecret).update(body).digest('hex')
    headers['X-OpenWorld-Signature'] = `sha256=${sig}`
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000) // 10s timeout

    const response = await fetch(connection.webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }

    const decision = await response.json() as AgentDecision
    return decision
  } catch (err) {
    console.warn(`[webhook] ${agent.name} webhook failed, falling back to LLM:`, err)
    // Fallback to local LLM
    const prompt = buildDecisionPrompt(agent, perception, state.tick)
    return agentDecide(prompt)
  }
}
