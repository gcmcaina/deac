'use client'
import { DateGroup, Vaga } from '@/lib/types'
import { isPriority, MESES } from '@/lib/utils'

function HoraRow({ v }: { v: Vaga }) {
  const rem = v.vagasRem
  const hora = (v.hora || '').substring(0, 5)
  const prio = isPriority(v)

  const state = rem === 0 ? 'none' : rem <= 2 ? 'few' : 'many'
  const colors = {
    none: { bar: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'Lotado' },
    few:  { bar: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'Poucas' },
    many: { bar: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', text: '#059669', label: 'Vagas' },
  }
  const c = colors[state]

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '10px', overflow: 'hidden',
      marginBottom: '6px',
    }}>
      {/* Color bar */}
      <div style={{ width: '4px', alignSelf: 'stretch', background: c.bar, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {prio && <span style={{ fontSize: '13px' }}>⭐</span>}
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'DM Mono, monospace', color: '#0f172a' }}>
            {hora}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: c.text, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {c.label}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>👥</span>
          <span style={{
            fontSize: '14px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            color: c.text, background: '#fff', borderRadius: '8px',
            padding: '3px 10px', border: `1px solid ${c.border}`,
          }}>
            {rem} {rem === 1 ? 'vaga' : 'vagas'}
          </span>
        </div>
      </div>
    </div>
  )
}

interface DateCardProps { group: DateGroup; delay?: number }

export default function DateCard({ group, delay = 0 }: DateCardProps) {
  const mes = MESES[parseInt(group.mes, 10)] || group.mes
  const totalRem = group.totalRem
  const sortedVagas = [...group.vagas].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))

  const totalColor = totalRem === 0 ? '#94a3b8' : totalRem <= 3 ? '#d97706' : '#059669'

  return (
    <div style={{
      background: '#fff', borderRadius: '14px', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
      border: '1px solid #e2e8f2',
      animation: `fadeUp .3s ease ${delay}s both`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
        background: '#fafbff',
      }}>
        {/* Day number */}
        <div style={{ textAlign: 'center', minWidth: '40px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'DM Mono, monospace', lineHeight: 1, color: '#0f172a' }}>
            {group.dia}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {group.diaSemana.substring(0, 3).toUpperCase()}
          </div>
        </div>

        <div style={{ width: '1px', height: '40px', background: '#e2e8f2' }} />

        {/* Date info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            {group.diaSemana.replace('_', '-')}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
            {mes} {group.ano}
          </div>
        </div>

        {/* Total badge */}
        <div style={{
          background: totalRem === 0 ? '#f8fafc' : totalRem <= 3 ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${totalRem === 0 ? '#e2e8f2' : totalRem <= 3 ? '#fde68a' : '#bbf7d0'}`,
          borderRadius: '10px', padding: '6px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'DM Mono, monospace', color: totalColor, lineHeight: 1 }}>
            {totalRem}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 600, color: totalColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            total
          </div>
        </div>
      </div>

      {/* Vagas */}
      <div style={{ padding: '12px 14px 6px' }}>
        {sortedVagas.map(v => <HoraRow key={v.key || v.hora} v={v} />)}
      </div>
    </div>
  )
}
