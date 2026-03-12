import OpenAI from 'openai'
import { AgentDecision } from '../world/types'

const client = new OpenAI({
  baseURL: process.env.LLM_API_URL || 'https://api.anthropic.com/v1',
  apiKey: process.env.LLM_API_KEY || '',
  defaultHeaders: undefined,
})

const MODEL = process.env.LLM_MODEL || 'claude-3-5-haiku-20241022'

export async function agentDecide(prompt: string): Promise<AgentDecision> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'You are an autonomous agent in a simulated world. Respond ONLY with valid JSON matching the schema provided. No markdown, no explanation outside the JSON.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const text = response.choices[0]?.message?.content ?? '{}'
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean) as AgentDecision
    return parsed
  } catch (err) {
    console.error('[LLM] Decision failed:', err)
    // Fallback: wander
    return {
      action: 'move',
      target: `${Math.floor(Math.random() * 3) - 1},${Math.floor(Math.random() * 3) - 1}`,
      reasoning: 'LLM unavailable, wandering.',
    }
  }
}
