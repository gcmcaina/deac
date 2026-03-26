'use client'
import { Vaga } from '@/lib/types'
import { isPriority } from '@/lib/utils'

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface CalendarProps { vagas: Vaga[] }

export default function Calendar({ vagas }: CalendarProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const todayD = now.getDate()

  // Build vaga map
  const vagaMap: Record<number, { rem: number; hasPriority: boolean }> = {}
  for (const v of vagas) {
    const d = parseInt(v.data.split('/')[0], 10)
    if (!vagaMap[d]) vagaMap[d] = { rem: 0, hasPriority: false }
    vagaMap[d].rem += v.vagasRem
    if (isPriority(v) && v.vagasRem > 0) vagaMap[d].hasPriority = true
  }

  const cells: React.ReactNode[] = []

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e${i}`} />)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const info = vagaMap[d]
    const isPast = d < todayD
    const isToday = d === todayD
    const isOdd = d % 2 !== 0

    let bg = 'transparent'
    let color = '#94a3b8'
    let opacity = 1
    let ring = ''

    if (isPast) {
      color = '#cbd5e1'; opacity = 0.5
    } else if (isOdd) {
      color = '#cbd5e1'; opacity = 0.3
    } else if (!info || info.rem === 0) {
      bg = '#fef2f2'; color = '#ef4444'
    } else if (info.hasPriority) {
      bg = '#fffbeb'; color = '#d97706'
    } else {
      bg = '#f0fdf4'; color = '#059669'
    }

    if (isToday) ring = '2px solid #2563eb'

    cells.push(
      <div
        key={d}
        title={info ? `${info.rem} vagas` : ''}
        style={{
          height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '11px', fontWeight: isToday ? 800 : 600,
          fontFamily: 'DM Mono, monospace', background: bg, color, opacity,
          outline: ring ? ring : undefined, outlineOffset: '-1px',
          cursor: 'default',
        }}
      >
        {d}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '3px' }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#94a3b8', padding: '4px 0', letterSpacing: '0.5px' }}>
            {d}
          </div>
        ))}
        {cells}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
        {[
          { color: '#059669', bg: '#f0fdf4', label: 'Disponível' },
          { color: '#d97706', bg: '#fffbeb', label: 'Prioritária' },
          { color: '#ef4444', bg: '#fef2f2', label: 'Sem vagas' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.bg, border: `1px solid ${l.color}`, flexShrink: 0 }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}
