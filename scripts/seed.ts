import { createClient } from '@supabase/supabase-js'
import { generateMap, randomWalkablePosition } from '../lib/world/map'
import { Agent } from '../lib/world/types'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAP_SIZE = parseInt(process.env.WORLD_MAP_SIZE ?? '50')

const STARTER_AGENTS = [
  {
    name: 'Alice',
    personality:
      'A curious explorer who wanders constantly, driven by an insatiable need to discover new places and meet strangers. She is warm, open-minded, and sees every encounter as an adventure. She shares what she finds freely.',
  },
  {
    name: 'Bob',
    personality:
      'A cautious builder who hoards resources and distrusts strangers. He is methodical, patient, and focused on survival and accumulation. He rarely speaks first, but keeps detailed mental notes on everyone he meets.',
  },
  {
    name: 'Charlie',
    personality:
      'A natural social connector who mediates conflicts and builds bridges between people. He has an uncanny ability to sense tension and defuse it. He values harmony above all else and will sacrifice his own resources for peace.',
  },
  {
    name: 'Diana',
    personality:
      'An ambitious, competitive leader who wants to control territory and direct others. She is decisive, persuasive, and unafraid of confrontation. She respects strength and views kindness as a strategy.',
  },
  {
    name: 'Eve',
    personality:
      'A contemplative philosopher who observes more than acts. She records history, speaks in metaphors, and often sees patterns others miss. She moves slowly and deliberately, and her rare words carry enormous weight.',
  },
]

async function seed() {
  console.log('🌍 Seeding Open World...')

  const map = generateMap(MAP_SIZE)

  // Create world
  const worldId = `world-${Date.now()}`
  const { error: worldErr } = await db.from('worlds').insert({
    id: worldId,
    name: 'Genesis',
    tick: 0,
    map_size: MAP_SIZE,
    map: map,
  })

  if (worldErr) {
    console.error('Failed to create world:', worldErr)
    process.exit(1)
  }

  console.log(`✅ World created: ${worldId}`)

  // Create agents
  for (const template of STARTER_AGENTS) {
    const position = randomWalkablePosition(map, MAP_SIZE)
    const agent = {
      id: `agent-${template.name.toLowerCase()}-${Date.now()}`,
      world_id: worldId,
      name: template.name,
      personality: template.personality,
      position,
      needs: { hunger: 20, safety: 20, social: 30, purpose: 40 },
      memory: [],
      relationships: {},
      inventory: {},
      alive: true,
      age: 0,
    }

    const { error } = await db.from('agents').insert(agent)
    if (error) {
      console.error(`Failed to create ${template.name}:`, error)
    } else {
      console.log(`✅ Agent created: ${template.name} at (${position.x}, ${position.y})`)
    }
  }

  console.log(`\n🚀 World seeded! World ID: ${worldId}`)
  console.log(`\nNext steps:`)
  console.log(`  1. Add WORLD_ID=${worldId} to .env.local`)
  console.log(`  2. Run: npm run dev`)
  console.log(`  3. Visit: http://localhost:3000`)
}

seed().catch(console.error)
