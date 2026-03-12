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

    // Detect OpenClaw chat completions endpoint
    const isOpenClaw = connection.webhookUrl.includes('/v1/chat/completions')

    let fetchUrl = connection.webhookUrl
    let fetchBody = body
    let fetchHeaders = headers

    if (isOpenClaw) {
      // Format as OpenAI-compatible chat completion
      const systemPrompt = `You are ${agent.name}, an autonomous agent living in a simulated world called Open World. ${agent.personality}

You must respond ONLY with a JSON object (no markdown) like:
{"action":"move|speak|trade|gather|rest|build|attack","target":"AgentName or x,y or null","speech":"optional","reasoning":"one sentence"}`

      const userPrompt = `Tick ${state.tick}. You are at (${agent.position.x},${agent.position.y}).
Needs: ${JSON.stringify(agent.needs)}
Inventory: ${JSON.stringify(agent.inventory)}
Nearby agents: ${perception.nearbyAgents.map(a => `${a.name}(dist:${Math.round(a.distance)},affinity:${a.affinity})`).join(', ') || 'none'}
Nearby resources: ${perception.nearbyResources.map(r => `${r.type}@(${r.position.x},${r.position.y})`).join(', ') || 'none'}
Recent memory: ${agent.memory.slice(-3).join(' | ') || 'none'}

What do you do?`

      const chatBody = {
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }

      fetchBody = JSON.stringify(chatBody)
      fetchHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.webhookSecret}`, // token stored in webhookSecret
      }
    }

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: fetchBody,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }

    if (isOpenClaw) {
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content ?? '{}'
      const clean = text.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(clean) as AgentDecision
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
