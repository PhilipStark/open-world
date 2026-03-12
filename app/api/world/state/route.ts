import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const worldId = searchParams.get('worldId')

  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 })

  const db = createServerClient()

  const [{ data: world }, { data: agents }, { data: events }] = await Promise.all([
    db.from('worlds').select('*').eq('id', worldId).single(),
    db.from('agents').select('*').eq('world_id', worldId).order('name'),
    db.from('world_events').select('*').eq('world_id', worldId).order('tick', { ascending: false }).limit(50),
  ])

  return NextResponse.json({ world, agents, events })
}
