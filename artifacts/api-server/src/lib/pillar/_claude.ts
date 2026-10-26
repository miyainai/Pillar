// Shared Claude call for the /api functions. The API key lives only in the
// server environment (ANTHROPIC_API_KEY), never in the browser.

import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-opus-5-5'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export function hasKey() {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Ask Claude for JSON. Returns the parsed object, or throws. */
export async function askForJson(system: string, user: string, maxTokens = 16000): Promise<unknown> {
  const client = new Anthropic()
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    // Low effort keeps Day 0 generation inside the demo's time budget.
    output_config: { effort: 'low' as const },
    system,
    messages: [{ role: 'user' as const, content: user }],
  }
  let message: Anthropic.Beta.Messages.BetaMessage
  try {
    // Server-side fallback reroutes a refused request to another model in the same call.
    message = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
  } catch (err) {
    if (!(err instanceof Anthropic.BadRequestError)) throw err
    message = await client.beta.messages.create(params)
  }
  if (message.stop_reason === 'refusal') throw new Error('The model declined this request.')
  if (message.stop_reason === 'max_tokens') throw new Error('The response was cut off before it finished.')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  return parseJsonLoose(text)
}

/** Pull the first JSON object out of a text response. */
export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON found in the response.')
  return JSON.parse(body.slice(start, end + 1))
}
