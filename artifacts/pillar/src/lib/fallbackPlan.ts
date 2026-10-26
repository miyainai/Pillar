// Pre-generated Day 0 plan for the Fernhill demo files, in the same shape the
// AI returns. Loaded when AI generation is not configured, fails, or runs long.

import type { RawPlan } from './ai'

export const FALLBACK_PLAN: RawPlan = {
  warnings: [],
  pillars: [
    {
      name: 'Procurement savings',
      objective: 'Cut direct materials, packaging, and freight cost through competitive re-bids and supplier consolidation.',
      rationale: 'IC case assumes 150 bps of COGS improvement; 1,400 SKUs are bought from 60+ suppliers with no re-bid in 4 years.',
      sourceRef: 'IC memo, p. 4 (EBITDA bridge)',
      targetImpact: 7.0,
      visibility: 'shared',
      owners: ['Jordan Lee', 'Casey Nguyen'],
      startMonth: 0,
      targetMonth: 24,
      subPillars: [
        {
          name: 'Direct materials re-bid', objective: 'Re-bid the top 20 SKUs (62% of spend), then consolidate the long tail.', targetImpact: 4.5, visibility: 'shared', owners: ['Casey Nguyen'], startMonth: 0, targetMonth: 12,
          phases: [
            { name: 'Top-20 SKU re-bid', description: 'Competitive RFQs on the 20 largest SKUs.', deliverables: ['Spend cube', 'Award letters'], startMonth: 0, endMonth: 4 },
            { name: 'Long-tail SKU consolidation', description: 'Move the long tail onto preferred suppliers.', deliverables: ['Consolidation plan'], startMonth: 4, endMonth: 8 },
            { name: 'Contract lock-in and PPV tracking', description: 'Sign contracts and track purchase price variance.', deliverables: ['Monthly PPV report'], startMonth: 8, endMonth: 12 },
          ],
          kpis: [{ name: 'Direct materials cost, % of net sales', unit: '%', baseline: 38.0, target: 35.5 }],
        },
        {
          name: 'Packaging and freight', objective: 'Consolidate carriers and rationalize packaging specs.', targetImpact: 2.5, visibility: 'shared', owners: ['Jordan Lee'], startMonth: 0, targetMonth: 12,
          phases: [
            { name: 'Spend baseline', description: 'Baseline spend by lane and spec.', deliverables: ['Spend baseline'], startMonth: 0, endMonth: 1 },
            { name: 'Freight carrier consolidation', description: 'Consolidate from 9 carriers to 3.', deliverables: ['RFP awards'], startMonth: 1, endMonth: 5 },
            { name: 'Packaging spec rationalization', description: 'Cut specs from 140 to 60.', deliverables: ['Spec library'], startMonth: 5, endMonth: 9 },
          ],
          kpis: [{ name: 'Freight cost per case', unit: '$', baseline: 2.1, target: 1.85 }],
        },
      ],
      phases: [],
      kpis: [],
    },
    {
      name: 'Club and e-commerce channel expansion',
      objective: 'Launch in the club channel and scale e-commerce from 3% to 8% of sales.',
      rationale: 'Fernhill has no club presence against a 14% category average, and e-commerce is under-indexed.',
      sourceRef: 'IC memo, p. 5 (growth levers)',
      targetImpact: 6.0,
      visibility: 'shared',
      owners: ['Morgan Blake'],
      startMonth: 0,
      targetMonth: 30,
      subPillars: [
        {
          name: 'Club launch', objective: 'Win national club distribution via a 400-door test.', targetImpact: 3.5, visibility: 'shared', owners: ['Morgan Blake'], startMonth: 0, targetMonth: 18,
          phases: [
            { name: 'Buyer pitch and slotting', description: 'Pitch club buyers and secure a test.', deliverables: ['Club pack design'], startMonth: 0, endMonth: 2 },
            { name: 'Regional club test', description: 'Run a 400-door test.', deliverables: ['Sell-through report'], startMonth: 2, endMonth: 6 },
            { name: 'National club rollout', description: 'Roll out to 1,200 doors.', deliverables: ['National slotting'], startMonth: 6, endMonth: 12 },
          ],
          kpis: [{ name: 'Club doors live', unit: 'doors', baseline: 0, target: 1200 }],
        },
        {
          name: 'E-commerce', objective: 'Relaunch Amazon, then add a DTC subscription.', targetImpact: 2.5, visibility: 'shared', owners: ['Morgan Blake'], startMonth: 1, targetMonth: 24,
          phases: [
            { name: 'Amazon storefront relaunch', description: 'New content, pricing, and ads.', deliverables: ['Ad plan'], startMonth: 1, endMonth: 3 },
            { name: 'DTC subscription launch', description: 'Launch a subscription box.', deliverables: ['Site build'], startMonth: 3, endMonth: 7 },
            { name: 'Retail media scale-up', description: 'Scale retail media at Walmart and Target.', deliverables: ['Retail media plan'], startMonth: 7, endMonth: 12 },
          ],
          kpis: [{ name: 'E-commerce net sales, monthly', unit: '$M', baseline: 0.6, target: 1.5 }],
        },
      ],
      phases: [],
      kpis: [],
    },
    {
      name: 'Pricing and mix',
      objective: 'Take a 4% list price increase and shift mix toward premium SKUs.',
      rationale: 'No list price taken in 3 years while peers took 6 to 9%; premium SKUs carry 11 points more gross margin.',
      sourceRef: 'IC memo, p. 6',
      targetImpact: 5.0,
      visibility: 'shared',
      owners: ['Morgan Blake'],
      startMonth: 0,
      targetMonth: 24,
      subPillars: [
        {
          name: 'List price increase', objective: 'Land a 4% increase with the top 15 customers.', targetImpact: 3.0, visibility: 'shared', owners: ['Morgan Blake'], startMonth: 0, targetMonth: 9,
          phases: [
            { name: 'Price elasticity study', description: 'Model elasticity by SKU and customer.', deliverables: ['Elasticity model'], startMonth: 0, endMonth: 1 },
            { name: 'Customer negotiations', description: 'Negotiate the increase with the top 15.', deliverables: ['Signed acceptances'], startMonth: 1, endMonth: 5 },
            { name: 'Price realization tracking', description: 'Track realized price monthly.', deliverables: ['Monthly report'], startMonth: 5, endMonth: 9 },
          ],
          kpis: [{ name: 'Net price realization', unit: '%', baseline: 0, target: 4.0 }],
        },
        {
          name: 'Premium mix shift', objective: 'Grow premium SKUs from 18% to 26% of sales.', targetImpact: 2.0, visibility: 'shared', owners: ['Morgan Blake'], startMonth: 4, targetMonth: 24,
          phases: [
            { name: 'Premium SKU roadmap', description: 'Pick SKUs to push and cut.', deliverables: ['SKU roadmap'], startMonth: 4, endMonth: 6 },
            { name: 'Innovation launches', description: 'Launch 4 premium innovations.', deliverables: ['Launch plan'], startMonth: 6, endMonth: 12 },
            { name: 'Shelf reset with top retailers', description: 'Reset shelves to favor premium.', deliverables: ['Planograms'], startMonth: 12, endMonth: 16 },
          ],
          kpis: [{ name: 'Premium SKU share of sales', unit: '%', baseline: 18, target: 26 }],
        },
      ],
      phases: [],
      kpis: [],
    },
    {
      name: 'Plant efficiency',
      objective: 'Raise OEE at the Dayton plant from 61% to 72% and cut changeover time.',
      rationale: 'OEE benchmarks 11 points below best-in-class snack plants; overtime runs at 14% of hours.',
      sourceRef: 'IC memo, p. 7',
      targetImpact: 4.0,
      visibility: 'shared',
      owners: ['Jordan Lee'],
      startMonth: 3,
      targetMonth: 30,
      subPillars: [
        {
          name: 'Line efficiency', objective: 'Retrofit line 3 and cut changeover time by 40%.', targetImpact: 2.5, visibility: 'shared', owners: ['Jordan Lee'], startMonth: 3, targetMonth: 18,
          phases: [
            { name: 'OEE baseline study', description: 'Measure OEE by line and shift.', deliverables: ['OEE baseline'], startMonth: 3, endMonth: 5 },
            { name: 'Line 3 retrofit', description: 'New fryer and seasoning drum.', deliverables: ['Capex approval'], startMonth: 5, endMonth: 10 },
            { name: 'Changeover reduction', description: 'SMED program.', deliverables: ['SMED playbook'], startMonth: 10, endMonth: 14 },
          ],
          kpis: [{ name: 'OEE, all lines', unit: '%', baseline: 61, target: 72 }],
        },
        {
          name: 'Labor scheduling', objective: 'Redesign shifts and realign headcount to demand.', targetImpact: 1.5, visibility: 'firm', owners: ['Jordan Lee'], startMonth: 5, targetMonth: 14,
          phases: [
            { name: 'Shift pattern redesign', description: 'Demand-based scheduling.', deliverables: ['New shift model'], startMonth: 5, endMonth: 7 },
            { name: 'Headcount realignment', description: 'Reduce temp labor and realign roles.', deliverables: ['Headcount plan'], startMonth: 7, endMonth: 9 },
            { name: 'Overtime controls', description: 'Overtime approval controls.', deliverables: ['Overtime policy'], startMonth: 9, endMonth: 12 },
          ],
          kpis: [{ name: 'Overtime, % of hours', unit: '%', baseline: 14, target: 8 }],
        },
      ],
      phases: [],
      kpis: [],
    },
    {
      name: 'Add-on M&A',
      objective: 'Close one add-on in a complementary snack category within 18 months.',
      rationale: 'IC case includes one $3M EBITDA add-on at 7x; regional brands trade below the platform multiple.',
      sourceRef: 'IC memo, p. 8',
      targetImpact: 3.0,
      visibility: 'shared',
      owners: ['Priya Raman'],
      startMonth: 0,
      targetMonth: 18,
      subPillars: [
        {
          name: 'Pipeline build', objective: 'Build a pipeline of 25 qualified targets.', targetImpact: 0, visibility: 'shared', owners: ['Priya Raman'], startMonth: 0, targetMonth: 8,
          phases: [
            { name: 'Thesis and screening', description: 'Define the thesis and screen.', deliverables: ['Long list'], startMonth: 0, endMonth: 1 },
            { name: 'Outreach to 25 targets', description: 'Qualify targets.', deliverables: ['Qualified pipeline'], startMonth: 1, endMonth: 5 },
            { name: 'Management meetings', description: 'Meet the top 5.', deliverables: ['Meeting notes'], startMonth: 5, endMonth: 8 },
          ],
          kpis: [{ name: 'Qualified add-on targets', unit: 'targets', baseline: 0, target: 25 }],
        },
        {
          name: 'First add-on close', objective: 'Sign and close the first add-on.', targetImpact: 3.0, visibility: 'shared', owners: ['Priya Raman'], startMonth: 4, targetMonth: 18,
          phases: [
            { name: 'LOI on lead target', description: 'Sign an LOI.', deliverables: ['Signed LOI'], startMonth: 4, endMonth: 6 },
            { name: 'Confirmatory diligence', description: 'QoE and commercial diligence.', deliverables: ['QoE'], startMonth: 6, endMonth: 8 },
            { name: 'Close and integration plan', description: 'Close and integrate.', deliverables: ['Integration plan'], startMonth: 8, endMonth: 11 },
          ],
          kpis: [],
        },
      ],
      phases: [],
      kpis: [],
    },
    {
      name: 'Finance leadership transition',
      objective: 'Build out the finance team and plan CFO succession ahead of the exit process.',
      rationale: 'Enabler with no direct EBITDA. QoE flagged a 12-day close and thin FP&A.',
      sourceRef: 'IC memo, p. 9 (key risks)',
      targetImpact: 0,
      visibility: 'firm',
      owners: ['Alex Chen'],
      startMonth: 0,
      targetMonth: 12,
      subPillars: [],
      phases: [
        { name: 'Finance team build-out', description: 'Hire a controller and FP&A lead.', deliverables: ['Controller hire', '6-day close'], startMonth: 0, endMonth: 5 },
        { name: 'CFO succession plan', description: 'Search and transition ahead of exit.', deliverables: ['Shortlist', 'Transition plan'], startMonth: 5, endMonth: 12 },
      ],
      kpis: [{ name: 'Monthly close, business days', unit: 'days', baseline: 12, target: 6 }],
    },
  ],
}
