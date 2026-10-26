// Management version assist: suggests a rewrite of a data request for management.
// It only suggests; the associate edits and sends.

import Anthropic from '@anthropic-ai/sdk'
import { askForJson, hasKey, json } from './_claude.js'

const SYSTEM = `You help a private equity associate rewrite an internal data request so it can go to the portfolio company's management team.

The rewrite must:
- Drop all internal context: why the deal team wants it, opinions about management or suppliers, deal strategy, and any hint of Firm only topics (leadership changes, headcount actions, exit timing, refinancing, add-on targets).
- Keep the exact data, time period, format, and due date.
- Be short, polite, and specific, as a request from the deal team. Start the description with "Please send".

Respond with only JSON: {"title": "...", "description": "..."}`

export async function POST(request: Request): Promise<Response> {
  if (!hasKey()) return json({ error: 'not_configured' }, 503)
  const body = (await request.json()) as { title: string; description: string; dueDate: string }
  const due = new Date(body.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const user = `Internal request title: ${body.title}
Internal request: ${body.description || '(no description)'}
Due date: ${due}`
  try {
    const result = await askForJson(SYSTEM, user, 1500)
    return json({ result })
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? (err.status ?? 502) : 502
    return json({ error: err instanceof Error ? err.message : String(err) }, status >= 500 ? 502 : status)
  }
}
