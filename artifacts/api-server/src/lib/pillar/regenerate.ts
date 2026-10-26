// Regenerate one pillar or sub-pillar with a one-line instruction.

import Anthropic from '@anthropic-ai/sdk'
import { askForJson, hasKey, json } from './_claude.js'

const SYSTEM = `You revise one part of a private equity value creation plan (VCP) based on a one-line instruction from the deal team.

Keep everything the instruction does not ask you to change. Dollar figures are run-rate EBITDA impact in $M; sub-pillar targets must sum exactly to the pillar target. Mark items "firm" (hidden from management) when they touch leadership changes, headcount actions, exit timing, refinancing, or add-on targets. Months are offsets from the close date. Owners must come from the people list.

Respond with only the revised JSON object, in exactly the same shape as the input, no prose.`

export async function POST(request: Request): Promise<Response> {
  if (!hasKey()) return json({ error: 'not_configured' }, 503)
  const body = (await request.json()) as {
    kind: 'pillar' | 'subPillar'
    current: unknown
    instruction: string
    context: { company: string; people: { name: string; role: string }[]; parentPillar?: string }
  }
  const user = `Company: ${body.context.company}
${body.context.parentPillar ? `Parent pillar: ${body.context.parentPillar}\n` : ''}People: ${body.context.people.map((p) => `${p.name} (${p.role})`).join(', ')}

Current ${body.kind === 'pillar' ? 'pillar' : 'sub-pillar'}:
${JSON.stringify(body.current, null, 2)}

Instruction: ${body.instruction}`
  try {
    const result = await askForJson(SYSTEM, user, 8000)
    return json({ result })
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? (err.status ?? 502) : 502
    return json({ error: err instanceof Error ? err.message : String(err) }, status >= 500 ? 502 : status)
  }
}
