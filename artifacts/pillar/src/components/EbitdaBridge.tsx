import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { fmtEbitda, fmtPct, type Bridge, type BridgeStep } from '../lib/bridge'
import { StatusPill } from './ui'

/**
 * Waterfall from entry EBITDA, through each pillar, to the target.
 * Solid = realized, outlined = yet to realize, hatched = realized since the comparison point.
 * Hover for a summary, click a pillar for detail.
 */
export function EbitdaBridge({
  bridge,
  height = 300,
  selectedKey = null,
  onSelect,
  tooltipExtra,
  svgRef,
  compact = false,
  asOf = 'today',
  className,
}: {
  bridge: Bridge
  height?: number
  selectedKey?: string | null
  onSelect?: (step: BridgeStep | null) => void
  /** Extra tooltip line for a pillar, e.g. what was added this period. */
  tooltipExtra?: (step: BridgeStep) => ReactNode
  svgRef?: RefObject<SVGSVGElement | null>
  compact?: boolean
  /** Short label for the point in time the solid bars show, written on the target bar. */
  asOf?: string
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const hatchId = `bridge-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The tooltip is positioned against the viewport, so drop it when anything scrolls.
  useEffect(() => {
    if (!hover) return
    const clear = () => setHover(null)
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [hover])

  const { steps } = bridge
  const m = { left: 46, right: 10, top: compact ? 22 : 26, bottom: compact ? 36 : 58 }
  const plotW = Math.max(0, width - m.left - m.right)
  const plotH = Math.max(0, height - m.top - m.bottom)
  const n = steps.length
  const colW = n ? plotW / n : 0
  const barW = Math.min(compact ? 56 : 72, colW * 0.62)

  // A truncated axis: bridges read better when the pillar steps fill the height.
  const top = Math.max(bridge.target, bridge.current, bridge.icCase ?? 0, ...steps.map((s) => s.total))
  const span = Math.max(top - Math.min(bridge.entry, bridge.current), top * 0.2, 1)
  const step = niceStep(span / 4)
  const yMin = Math.max(0, Math.floor((Math.min(bridge.entry, bridge.current) - span * 0.5) / step) * step)
  const yMax = Math.ceil((top + span * 0.1) / step) * step
  let tickStep = step
  while ((yMax - yMin) / tickStep > 6) tickStep *= 2
  const ticks: number[] = []
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax + 1e-9; v += tickStep) ticks.push(Math.round(v * 100) / 100)
  const y = (v: number) => m.top + plotH * (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin || 1))
  const xOf = (i: number) => m.left + i * colW + (colW - barW) / 2

  const fontLabel = compact ? 10.5 : 11.5
  const hovered = steps.find((s) => s.key === hover) ?? null
  const hoveredIndex = hovered ? steps.indexOf(hovered) : -1

  return (
    <div ref={wrapRef} className={clsx('relative w-full select-none', className)} onMouseLeave={() => setHover(null)}>
      <svg ref={svgRef} width={width || undefined} height={height} viewBox={`0 0 ${width || 1} ${height}`} style={{ fontFamily: 'inherit', display: 'block' }} role="img" aria-label={`EBITDA bridge from entry to target by ${steps.some((s) => s.kind === 'organic') ? 'organic growth and pillar' : 'pillar'}`}>
        {width > 0 && (
          <>
            <defs>
              <pattern id={hatchId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={6} stroke="#fff" strokeWidth={2.2} strokeOpacity={0.6} />
              </pattern>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="#f1f1f3" />
                <text x={m.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={10.5} fill="#a1a1aa" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  ${Number.isInteger(t) ? t : t.toFixed(1)}M
                </text>
              </g>
            ))}
            <line x1={m.left} x2={width - m.right} y1={m.top + plotH} y2={m.top + plotH} stroke="#e4e4e7" />

            {/* Column highlights paint before every step group so a neighbor's highlight never covers a connector. */}
            {steps.map((s, i) => {
              const isSel = selectedKey === s.key
              const isHover = hover === s.key
              if (!isSel && !isHover) return null
              return <rect key={`hl-${s.key}`} x={m.left + i * colW + 2} y={m.top - 4} width={colW - 4} height={plotH + 4} rx={6} fill={isSel ? '#f4f4f5' : '#fafafa'} pointerEvents="none" />
            })}

            {steps.map((s, i) => {
              const x = xOf(i)
              const isSel = selectedKey === s.key
              const isHover = hover === s.key
               const selectable = s.kind !== 'total' && !!onSelect
              const bottom = m.top + plotH
              const solidTop = y(s.base + s.solid)
              const solidBottom = s.kind === 'total' ? bottom : y(s.base)
              const outlineTop = y(s.base + s.solid + s.outline)
              const heightValue = s.solid + s.outline
              const label = s.kind === 'total' ? fmtEbitda(s.total) : heightValue > 0.005 ? `+${fmtEbitda(heightValue)}` : '—'
              const next = steps[i + 1]
              return (
                <g
                  key={s.key}
                  tabIndex={selectable ? 0 : -1}
                  role={selectable ? 'button' : undefined}
                  aria-label={selectable ? `${s.name}: ${fmtEbitda(s.realized ?? 0)} realized of ${fmtEbitda(s.target ?? 0)}` : undefined}
                  aria-pressed={selectable ? isSel : undefined}
                  style={{ cursor: selectable ? 'pointer' : 'default', outline: 'none' }}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover((h) => (h === s.key ? null : h))}
                  onFocus={() => setHover(s.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => selectable && onSelect?.(isSel ? null : s)}
                  onKeyDown={(e) => {
                    if (selectable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onSelect?.(isSel ? null : s)
                    }
                  }}
                >
                  {/* Hit area for the whole column */}
                  <rect x={m.left + i * colW} y={m.top - 6} width={colW} height={plotH + 6 + m.bottom} fill="transparent" />
                  {next && (
                    <line x1={x + barW} x2={xOf(i + 1)} y1={y(s.total)} y2={y(s.total)} stroke="#c4c4c8" strokeDasharray="2 3" />
                  )}
                  {s.solid > 0.005 && (
                    <rect x={x} y={solidTop} width={barW} height={Math.max(1, solidBottom - solidTop)} fill={s.color} style={{ transition: 'y .25s ease, height .25s ease' }} />
                  )}
                  {/* The part of the realized bar that was added since the comparison point. */}
                  {s.gained !== undefined && s.gained > 0.005 && (
                    <g pointerEvents="none">
                      <rect x={x} y={solidTop} width={barW} height={Math.max(1, y(s.base + s.solid - s.gained) - solidTop)} fill={`url(#${hatchId})`} />
                      <line x1={x} x2={x + barW} y1={y(s.base + s.solid - s.gained)} y2={y(s.base + s.solid - s.gained)} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  )}
                  {/* The target bar says where EBITDA stands today, not only where it should end up. */}
                  {s.key === 'target' && s.solid > 0.005 && solidBottom - solidTop >= 30 && (
                    <g pointerEvents="none">
                      <text x={x + barW / 2} y={solidTop + 14} textAnchor="middle" fontSize={fontLabel} fontWeight={600} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtEbitda(s.solid)}
                      </text>
                      <text x={x + barW / 2} y={solidTop + 26} textAnchor="middle" fontSize={fontLabel - 2} fill="#fff" fillOpacity={0.75}>
                        {asOf}
                      </text>
                    </g>
                  )}
                  {s.outline > 0.005 && (
                    <rect
                      x={x + 0.75}
                      y={outlineTop + 0.75}
                      width={barW - 1.5}
                      height={Math.max(1, solidTop - outlineTop - 1.5)}
                      fill={s.color}
                      fillOpacity={0.08}
                      stroke={s.color}
                      strokeWidth={1.5}
                      style={{ transition: 'y .25s ease, height .25s ease' }}
                    />
                  )}
                  {heightValue <= 0.005 && s.kind !== 'total' && <line x1={x} x2={x + barW} y1={y(s.base)} y2={y(s.base)} stroke={s.color} strokeWidth={2} />}
                  <text x={x + barW / 2} y={Math.min(outlineTop, solidTop, y(s.base)) - 6} textAnchor="middle" fontSize={fontLabel} fontWeight={600} fill={s.kind === 'total' ? '#18181b' : heightValue > 0.005 ? '#3f3f46' : '#a1a1aa'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {label}
                  </text>
                  {wrap(s.label, colW - 8, fontLabel - 0.5).map((line, li) => (
                    <text key={li} x={x + barW / 2} y={bottom + (compact ? 13 : 15) + li * 13} textAnchor="middle" fontSize={fontLabel - 0.5} fontWeight={s.kind === 'total' || isSel ? 600 : 400} fill={s.kind === 'total' ? '#18181b' : '#52525b'}>
                      {line}
                    </text>
                  ))}
                  {!compact && s.kind !== 'total' && (
                    <text x={x + barW / 2} y={bottom + 15 + 2 * 13} textAnchor="middle" fontSize={10.5} fill="#a1a1aa" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {bridge.mode === 'gap' ? `${fmtPct(s.gap ?? 0, s.target ?? 0)} to go` : `${fmtPct(s.realized ?? 0, s.target ?? 0)} realized`}
                    </text>
                  )}
                </g>
              )
            })}

            {bridge.icCase !== undefined && bridge.icCase >= yMin && bridge.icCase <= yMax && (
              <g pointerEvents="none">
                <line x1={m.left} x2={width - m.right} y1={y(bridge.icCase)} y2={y(bridge.icCase)} stroke="#a1a1aa" strokeDasharray="4 3" />
                <text x={width - m.right} y={y(bridge.icCase) - 4} textAnchor="end" fontSize={10} fill="#71717a">
                  IC case {fmtEbitda(bridge.icCase)}
                </text>
              </g>
            )}
          </>
        )}
      </svg>

      {hovered && width > 0 && wrapRef.current && (
        <BridgeTooltip step={hovered} bridge={bridge} extra={tooltipExtra} selectable={!!onSelect && hovered.kind !== 'total'} anchor={wrapRef.current} x={xOf(hoveredIndex) + barW / 2} y={y(Math.max(hovered.total, hovered.base + hovered.solid + hovered.outline)) - 10} />
      )}
    </div>
  )
}

/** Rendered on the body (viewport coordinates) so a scrolling or clipping card never cuts it off. */
function BridgeTooltip({ step: s, bridge, extra, selectable, anchor, x, y }: { step: BridgeStep; bridge: Bridge; extra?: (s: BridgeStep) => ReactNode; selectable: boolean; anchor: HTMLElement; x: number; y: number }) {
  const w = 232
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(Math.max(rect.left + x - w / 2, 8), Math.max(8, window.innerWidth - w - 8))
  const top = rect.top + y
  const above = top > 170
  return createPortal(
    <div className="pointer-events-none fixed z-[70] rounded-lg border border-zinc-200 bg-white p-2.5 text-[12px] shadow-lg" style={{ width: w, left, top: above ? top - 8 : top + 24, transform: above ? 'translateY(-100%)' : undefined }} role="tooltip">
      <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
        <span className="truncate">{s.kind === 'pillar' ? `${s.num}. ${s.name}` : s.name}</span>
      </div>
      {s.kind !== 'total' ? (
        <dl className="tabular mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-zinc-600">
          <dt>Target</dt>
          <dd className="text-right font-medium text-zinc-900">+{fmtEbitda(s.target ?? 0)}</dd>
          <dt>Realized</dt>
          <dd className="text-right font-medium text-green-700">
            {fmtEbitda(s.realized ?? 0)} <span className="font-normal text-zinc-400">({fmtPct(s.realized ?? 0, s.target ?? 0)})</span>
          </dd>
          <dt>To go</dt>
          <dd className="text-right font-medium text-zinc-900">{fmtEbitda(s.gap ?? 0)}</dd>
        </dl>
      ) : (
        <div className="tabular mt-1 text-zinc-600">
          {s.key === 'entry' && <>{fmtEbitda(s.total)} at close</>}
          {s.key === 'current' && (
            <>
              {fmtEbitda(s.total)} · entry plus {fmtEbitda(bridge.realized)} realized
            </>
          )}
          {s.key === 'target' && (
            <>
              <div>
                {fmtEbitda(s.total)} target · <span className="font-medium text-zinc-900">{fmtEbitda(s.solid)}</span> reached so far
              </div>
              <div className="text-zinc-500">
                 Entry {fmtEbitda(bridge.entry)} plus {fmtEbitda(bridge.realized)} realized and {fmtEbitda(bridge.gap)} yet to realize
              </div>
            </>
          )}
        </div>
      )}
      {s.kind === 'pillar' && extra?.(s)}
      {s.kind === 'organic' && <p className="mt-1.5 text-zinc-500">Growth beyond entry EBITDA, excluding pillar initiatives. {selectable && 'Click for detail.'}</p>}
      {s.kind === 'pillar' && s.status && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <StatusPill status={s.status} />
          {selectable && <span className="text-[11px] text-zinc-400">Click for detail</span>}
        </div>
      )}
    </div>,
    document.body,
  )
}

export function BridgeLegend({ bridge, sinceLabel, className }: { bridge: Bridge; /** Names the comparison point when the bridge hatches what was added since it. */ sinceLabel?: string; className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-zinc-500', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-zinc-700" /> Realized
      </span>
      {bridge.gained !== undefined && bridge.mode !== 'gap' && (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.65) 0 1.5px, transparent 1.5px 4px), #3f3f46' }} /> Added since {sinceLabel ?? 'the comparison point'}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border-[1.5px] border-zinc-500 bg-zinc-100" /> Yet to realize
      </span>
      <span className="text-zinc-400">Run-rate EBITDA, $M · {bridge.steps.some((s) => s.kind === 'organic') ? 'slate = organic; colored bars = pillars' : "bars take their pillar's color"}</span>
      {bridge.excluded.length > 0 && (
        <span className="text-zinc-400">
          Not shown (no EBITDA target): {bridge.excluded.join(', ')}
        </span>
      )}
    </div>
  )
}

function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)))
  const r = raw / mag
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10
  return nice * mag
}

/** Wrap a label onto at most two lines for the available pixel width (approximate glyph width). */
function wrap(label: string, px: number, fontSize: number): string[] {
  const max = Math.max(4, Math.floor(px / (fontSize * 0.54)))
  const words = label.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= max) line += ' ' + w
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  const cut = (t: string) => (t.length > max ? t.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : t)
  if (lines.length <= 2) return lines.map(cut)
  return [cut(lines[0]), cut(lines.slice(1).join(' '))]
}
