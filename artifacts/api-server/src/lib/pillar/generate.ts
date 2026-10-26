// VCP generation: deal materials + plan settings -> draft pillars (SPEC.md section 7).

import Anthropic from '@anthropic-ai/sdk'
import { askForJson, hasKey, json } from './_claude.js'

const LEVELS: Record<string, string> = {
  Light: 'exactly 2 sub-pillars per pillar, 2 phases per sub-pillar, no KPIs (empty kpis arrays), one-line deliverables lists may be empty',
  Standard: '2 to 3 sub-pillars per pillar, 3 phases per sub-pillar, and 1 KPI per sub-pillar',
  Detailed: 'up to 4 sub-pillars per pillar, 4 phases per sub-pillar, 1 to 2 KPIs per sub-pillar, suggested owners, and 2 to 3 deliverables per phase',
}

export const SCHEMA = `{
  "pillars": [
    {
      "name": "Procurement savings",
      "objective": "one sentence",
      "rationale": "one or two sentences tying the pillar to the investment thesis and EBITDA bridge",
      "sourceRef": "document name and page, e.g. \\"IC memo, p. 4\\"",
      "targetImpact": 7.0,
      "visibility": "shared" | "firm",
      "owners": ["names from the people list"],
      "startMonth": 0,
      "targetMonth": 24,
      "subPillars": [
        {
          "name": "...", "objective": "...", "targetImpact": 4.5, "visibility": "shared" | "firm", "owners": ["..."],
          "startMonth": 0, "targetMonth": 18,
          "phases": [{ "name": "...", "description": "...", "deliverables": ["..."], "startMonth": 0, "endMonth": 4 }],
          "kpis": [{ "name": "...", "unit": "%" | "$" | "$M" | "count" | "days" | "...", "baseline": 38.0, "target": 35.5 }]
        }
      ],
      "phases": [],
      "kpis": []
    }
  ],
  "warnings": ["anything the deal team should check"]
}`

const SYSTEM = `You draft value creation plans (VCPs) for private equity deal teams from their deal materials.

A VCP has 3 to 8 pillars. Each pillar has sub-pillars, and each sub-pillar has dated phases and KPIs. Dollar figures are run-rate EBITDA impact in millions of US dollars.

Rules:
- Lean on the IC memo's investment thesis and EBITDA bridge. Pillar targets should roughly sum to the gap between entry EBITDA and underwritten exit EBITDA. If the materials do not support that, say so in "warnings".
- Sub-pillar targets must sum exactly to their pillar's target. Enabler pillars (no direct EBITDA) have a target of 0.
- Every pillar's rationale must be grounded in the materials, and "sourceRef" must cite the document and page it came from (pages are marked like [Document name, page 3] in the text). Never invent a page.
- Mark a pillar or sub-pillar "firm" (Firm only, hidden from management) when it touches leadership changes, headcount actions, exit timing, refinancing, or add-on targets. Everything else is "shared".
- If a pillar has no natural sub-pillars, leave "subPillars" empty and put its phases and KPIs directly on the pillar.
- Owners: pick from the people list. Operating partners (OP) usually own operational pillars; deal team members can own pillars such as add-on M&A or finance leadership.
- Months are offsets from the close date (0 = close). Keep phases inside the hold period.
- Write plainly and briefly, like a deal team would.

Respond with only a JSON object in this shape, no prose:
${SCHEMA}`

export async function POST(request: Request): Promise<Response> {
  if (!hasKey()) return json({ error: 'not_configured' }, 503)
  const body = (await request.json()) as {
    company: { name: string; sector: string; entryEbitda: number; exitEbitda: number; holdYears: number }
    settings: { pillarCount: number; detail: string; levers: string[] }
    people: { name: string; role: string; title: string }[]
    documents: { name: string; type: string; text: string }[]
  }
  const { company, settings, people, documents } = body
  const docs = documents.map((d) => `<document name="${d.name}" type="${d.type}">\n${d.text}\n</document>`).join('\n\n')
  const user = `Company: ${company.name} (${company.sector})
Entry EBITDA: $${company.entryEbitda}M. Underwritten exit EBITDA: $${company.exitEbitda}M in year ${company.holdYears}. Gap to cover: $${(company.exitEbitda - company.entryEbitda).toFixed(1)}M.

Plan settings:
- Pillars: ${settings.pillarCount}
- Detail level: ${settings.detail}: ${LEVELS[settings.detail] ?? LEVELS.Standard}
- Focus levers: ${settings.levers.length ? settings.levers.join(', ') : 'none chosen; follow the materials'}

People:
${people.map((p) => `- ${p.name} (${p.role}${p.title ? `, ${p.title}` : ''})`).join('\n')}

Deal materials:
${docs || '(none uploaded)'}

Draft the plan now.`

  try {
    const plan = await askForJson(SYSTEM, user)
    return json({ plan })
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? (err.status ?? 502) : 502
    return json({ error: err instanceof Error ? err.message : String(err) }, status >= 500 ? 502 : status)
  }
}
