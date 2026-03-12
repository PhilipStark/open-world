/**
 * Vercel Cron — auto-ticks the default world every minute
 * Called by vercel.json schedule
 */
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Vercel cron auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const worldId = process.env.DEFAULT_WORLD_ID
  if (!worldId) return NextResponse.json({ error: 'No DEFAULT_WORLD_ID set' }, { status: 400 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/world/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worldId }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}
