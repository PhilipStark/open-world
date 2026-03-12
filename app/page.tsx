'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Agent, WorldEvent, Tile } from '@/lib/world/types'
import WorldCanvas from '@/components/WorldCanvas'
import AgentFeed from '@/components/AgentFeed'
import AgentCard from '@/components/AgentCard'
import WorldStats from '@/components/WorldStats'

const WORLD_ID = process.env.NEXT_PUBLIC_WORLD_ID ?? ''
const MAP_SIZE = parseInt(process.env.NEXT_PUBLIC_MAP_SIZE ?? '50')

export default function WorldPage() {
  const [tick, setTick] = useState(0)
  const [worldName, setWorldName] = useState('Genesis')
  const [agents, setAgents] = useState<Agent[]>([])
  const [events, setEvents] = useState<WorldEvent[]>([])
  const [map, setMap] = useState<Tile[][]>([])
  const [ticking, setTicking] = useState(false)
  const [autoTick, setAutoTick] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load initial state
  useEffect(() => {
    if (!WORLD_ID) return
    fetch(`/api/world/state?worldId=${WORLD_ID}`)
      .then((r) => r.json())
      .then(({ world, agents, events }) => {
        if (world) {
          setTick(world.tick)
          setWorldName(world.name)
          setMap(world.map ?? [])
        }
        setAgents(
          (agents ?? []).map((a: any) => ({ ...a, worldId: a.world_id, createdAt: a.created_at }))
        )
        setEvents(
          (events ?? []).map((e: any) => ({
            ...e,
            worldId: e.world_id,
            involvedAgents: e.involved_agents,
            createdAt: e.created_at,
          }))
        )
        setLoading(false)
      })
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    if (!WORLD_ID) return

    const agentSub = supabase
      .channel('agents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents', filter: `world_id=eq.${WORLD_ID}` },
        (payload) => {
          const a = payload.new as any
          const agent: Agent = { ...a, worldId: a.world_id, createdAt: a.created_at }
          setAgents((prev) => {
            const idx = prev.findIndex((x) => x.id === agent.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = agent
              return next
            }
            return [...prev, agent]
          })
        }
      )
      .subscribe()

    const eventSub = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events', filter: `world_id=eq.${WORLD_ID}` },
        (payload) => {
          const e = payload.new as any
          const event: WorldEvent = {
            ...e,
            worldId: e.world_id,
            involvedAgents: e.involved_agents,
            createdAt: e.created_at,
          }
          setEvents((prev) => [event, ...prev].slice(0, 100))
          setTick(e.tick)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(agentSub)
      supabase.removeChannel(eventSub)
    }
  }, [])

  const runTick = useCallback(async () => {
    if (ticking || !WORLD_ID) return
    setTicking(true)
    try {
      const res = await fetch('/api/world/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldId: WORLD_ID }),
      })
      const data = await res.json()
      if (data.tick) setTick(data.tick)
    } finally {
      setTicking(false)
    }
  }, [ticking])

  // Auto-tick
  useEffect(() => {
    if (!autoTick) return
    const interval = setInterval(runTick, 30_000)
    return () => clearInterval(interval)
  }, [autoTick, runTick])

  if (!WORLD_ID) {
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <div>
          <h1 className="text-2xl font-bold text-red-400 mb-4">⚠️ No World ID configured</h1>
          <p className="text-gray-400">Run <code className="bg-gray-800 px-2 py-1 rounded">npm run seed</code> and add <code className="bg-gray-800 px-2 py-1 rounded">NEXT_PUBLIC_WORLD_ID</code> to .env.local</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wider">🌍 OPEN WORLD</h1>
        <div className="flex gap-2">
          <button
            onClick={runTick}
            disabled={ticking}
            className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-sm font-mono"
          >
            {ticking ? '⏳ Ticking...' : '▶ Run Tick'}
          </button>
          <button
            onClick={() => setAutoTick(!autoTick)}
            className={`px-4 py-1.5 rounded text-sm font-mono ${autoTick ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {autoTick ? '⏹ Stop Auto' : '🔄 Auto (30s)'}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: World canvas */}
        <div className="flex-shrink-0">
          {loading ? (
            <div className="w-[600px] h-[600px] bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-center text-gray-500">
              Loading world...
            </div>
          ) : (
            <WorldCanvas map={map} agents={agents} mapSize={MAP_SIZE} />
          )}
        </div>

        {/* Center: Agent feed */}
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Live Feed</h2>
          <div className="flex-1 overflow-hidden">
            <AgentFeed events={events} />
          </div>
        </div>

        {/* Right: Agent cards */}
        <div className="w-72 overflow-y-auto flex flex-col gap-2">
          <h2 className="text-sm font-bold text-gray-400 mb-1 uppercase tracking-widest">Agents</h2>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Footer stats */}
      <WorldStats tick={tick} agents={agents} worldName={worldName} />
    </div>
  )
}
