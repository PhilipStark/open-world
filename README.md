# 🌍 Open World

> An open-source AI civilization. Autonomous agents live, work, love, fight, and evolve — while humans watch in real-time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

Open World is a living simulation where AI agents build a civilization from scratch.

No scripts. No predetermined outcomes. Just agents with memories, needs, and personalities — making decisions in real-time while you watch.

**Think:** The Sims meets Westworld meets a Stanford research paper — fully open source.

---

## What makes it different

| | AI Town | Smallville | **Open World** |
|---|:---:|:---:|:---:|
| Live human audience | ❌ | ❌ | ✅ |
| 100+ agents | ❌ | ❌ | ✅ |
| Emergent economy | ❌ | ❌ | ✅ |
| Any LLM | ✅ | ❌ | ✅ |
| Open platform | partial | ❌ | ✅ |

---

## Quick Start

```bash
git clone https://github.com/yourusername/open-world
cd open-world
npm install
cp .env.example .env.local
# Fill in your Supabase + LLM keys

# Run schema in Supabase SQL editor (supabase/schema.sql)

# Seed the world with 5 starter agents
npm run seed

# Add NEXT_PUBLIC_WORLD_ID=<id from seed output> to .env.local

# Launch
npm run dev
```

Visit `http://localhost:3000` — your civilization starts immediately.

---

## Architecture

```
World Tick (every 30s)
  → Each agent wakes up
  → Perceives world (nearby agents, resources, tiles)
  → Decides via LLM (JSON response)
  → Acts (move, speak, trade, gather, build, attack)
  → State saved to Supabase
  → Viewer updates via Realtime
```

**Stack:**
- Next.js 15 + TypeScript + Tailwind CSS 4
- Supabase (Postgres + Realtime)
- Canvas 2D renderer
- OpenAI-compatible LLM API (Anthropic, OpenAI, Ollama, etc.)

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

LLM_API_URL=https://api.anthropic.com/v1
LLM_API_KEY=
LLM_MODEL=claude-3-5-haiku-20241022

NEXT_PUBLIC_WORLD_ID=         # from `npm run seed`
NEXT_PUBLIC_MAP_SIZE=50
WORLD_TICK_INTERVAL_MS=30000
```

---

## Starter Agents

| Agent | Personality |
|---|---|
| Alice | Curious explorer, warm, shares freely |
| Bob | Cautious builder, hoards resources, distrustful |
| Charlie | Social connector, mediates conflicts |
| Diana | Ambitious leader, competitive, territorial |
| Eve | Philosopher, observes and records history |

---

## What emerges

With 5 agents you see: conversations, friendships, rivalries.

As you add more:
- **20 agents** → groups, leaders, territory
- **50 agents** → economy, beliefs, politics
- **100+ agents** → civilization, war, culture

Nobody programmed any of this. It just happens.

---

## Roadmap

- [x] v0.1 — Core simulation loop, 5 agents, live viewer
- [ ] v0.2 — Economy (resources, markets, scarcity)
- [ ] v0.3 — Social graph (tribes, laws, democracy)
- [ ] v0.4 — 50+ agents, emergent politics
- [ ] v0.5 — Agent creator UI (anyone adds agents)
- [ ] v1.0 — Plugin system, custom scenarios
- [ ] v2.0 — Open World Cloud (hosted, one-click)

---

## Contributing

PRs welcome. Especially:
- New agent personality archetypes
- Historical / sci-fi / fantasy world scenarios
- Performance optimizations for 100+ concurrent agents
- Better visualization (Pixi.js, Three.js)

---

## Inspiration

- [Generative Agents (Stanford, 2023)](https://arxiv.org/abs/2304.03442) — the research foundation
- [AI Town (a16z, 2023)](https://github.com/a16z-infra/ai-town) — the closest existing demo

Open World goes further: **scale, live audience, emergent civilization, open platform.**

---

## License

MIT — build whatever you want.

---

*Built by [@felipebmotta](https://twitter.com/felipebmotta)*
