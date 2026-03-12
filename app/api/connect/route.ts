/**
 * OpenClaw Connection API
 *
 * Allows any OpenClaw instance to register as an agent in the world.
 *
 * POST /api/connect
 * {
 *   "worldId": "world-xxx",
 *   "agentName": "MeuKraken",
 *   "personality": "...",
 *   "webhookUrl": "https://your-openclaw.example.com/webhook",
 *   "webhookSecret": "optional-secret"
 * }
 *
 * Returns: { agentId, token }
 * The token is used to authenticate subsequent calls from this OpenClaw.
 *
 * When a tick runs, Open World sends a POST to webhookUrl:
 * {
 *   "event": "tick",
 *   "agentId": "...",
 *   "perception": { ... },
 *   "token": "..."
 * }
 *
 * OpenClaw responds with:
 * {
 *   "action": "move|speak|trade|gather|rest|build|attack",
 *   "target": "agentName or x,y or null",
 *   "speech": "optional message",
 *   "reasoning": "one sentence"
 * }
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { randomWalkablePosition } from '@/lib/world/map'
import crypto from 'crypto'

export async function POST(req: Request) {
  const body = await req.json()
  const { worldId, agentName, personality, webhookUrl, webhookSecret } = body

  if (!worldId || !agentName || !personality || !webhookUrl) {
    return NextResponse.json(
      { error: 'worldId, agentName, personality, webhookUrl required' },
      { status: 400 }
    )
  }

  const db = createServerClient()

  // Validate world exists
  const { data: world, error: worldErr } = await db
    .from('worlds')
    .select('id, map, map_size')
    .eq('id', worldId)
    .single()

  if (worldErr || !world) {
    return NextResponse.json({ error: 'World not found' }, { status: 404 })
  }

  // Generate agent token
  const token = crypto.randomBytes(32).toString('hex')
  const agentId = `agent-${agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

  // Place agent on map
  const position = randomWalkablePosition(world.map as any, world.map_size)

  // Create agent
  const { error: agentErr } = await db.from('agents').insert({
    id: agentId,
    world_id: worldId,
    name: agentName,
    personality,
    position,
    needs: { hunger: 10, safety: 10, social: 50, purpose: 70 },
    memory: [`[T0] ${agentName} connected to the world`],
    relationships: {},
    inventory: {},
    alive: true,
    age: 0,
  })

  if (agentErr) {
    return NextResponse.json({ error: agentErr.message }, { status: 500 })
  }

  // Store connection metadata (webhook URL + token)
  const { error: connErr } = await db.from('agent_connections').insert({
    agent_id: agentId,
    world_id: worldId,
    webhook_url: webhookUrl,
    webhook_secret: webhookSecret ?? null,
    token: token,
    connected_at: new Date().toISOString(),
  })

  if (connErr) {
    // Non-fatal: agent was created, just won't have webhook
    console.warn('[connect] Failed to store connection:', connErr.message)
  }

  return NextResponse.json({
    agentId,
    token,
    message: `${agentName} is now alive in the world. Your OpenClaw will receive POST requests at ${webhookUrl} on each tick.`,
    docsUrl: 'https://github.com/PhilipStark/open-world#connecting-your-openclaw',
  })
}

export async function GET() {
  return NextResponse.json({
    description: 'Open World — OpenClaw Connection API',
    version: '0.1.0',
    endpoints: {
      'POST /api/connect': 'Register your OpenClaw as an agent',
      'DELETE /api/connect': 'Disconnect your agent',
    },
    schema: {
      worldId: 'string — the world to join',
      agentName: 'string — your agent name',
      personality: 'string — 2-3 sentence personality description',
      webhookUrl: 'string — your OpenClaw webhook URL',
      webhookSecret: 'string (optional) — HMAC secret for verification',
    },
  })
}
