'use client'
import { useState } from 'react'
import Calendar from './Calendar'
import { Vaga, HistoricoItem } from '@/lib/types'
import { fmtTs } from '@/lib/utils'

interface Section {
  id: string
  icon: string
  label: string
  badge?: number
  defaultOpen: boolean
  children: React.ReactNode
}

function Accordion({ id, icon, label, badge, defaultOpen, children }: Section) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f2', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 14px', background: open ? '#fafbff' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid #f1f5f9' : 'none',
          transition: 'background .15s',
        }}
      >
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, flex: 1, color: '#0f172a', letterSpacing: '0.3px' }}>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{ background: '#2563eb', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '10px', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>
            {badge}
          </span>
        )}
        <span style={{ color: '#94a3b8', fontSize: '11px', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>▾</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

interface SidebarProps {
  vagas: Vaga[]
  historico: HistoricoItem[]
  onRunCheck: () => void
  onClearSnapshot: () => void
  isPushActive: boolean
  onTogglePush: () => void
}

export default function Sidebar({ vagas, historico, onRunCheck, onClearSnapshot, isPushActive, onTogglePush }: SidebarProps) {
  const [testTitle, setTestTitle] = useState('DEAC Monitor — Teste')
  const [testBody, setTestBody] = useState('Notificação de teste.')
  const [channels, setChannels] = useState({ fcm: true, ntfy: true })
  const [prio, setPrio] = useState<'default' | 'high' | 'urgent'>('high')
  const [testLog, setTestLog] = useState('')
  const [testLogType, setTestLogType] = useState<'ok' | 'err' | ''>('')
  const [sending, setSending] = useState(false)

  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || ''

  function toggleCh(ch: 'fcm' | 'ntfy') {
    setChannels(c => ({ ...c, [ch]: !c[ch] }))
  }

  async function sendTest() {
    if (!channels.fcm && !channels.ntfy) { setTestLog('Selecione ao menos um canal.'); setTestLogType('err'); return }
    setSending(true); setTestLog('Enviando...'); setTestLogType('')
    try {
      const r = await fetch(`${WORKER_URL}/send-test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: testTitle, body: testBody, priority: prio, channels }),
      })
      const d = await r.json()
      const results = []
      if (d.fcm)  results.push('PWA:' + (d.fcm.ok ? '✅' : '❌'))
      if (d.ntfy) results.push('ntfy:' + (d.ntfy.ok ? '✅' : '❌'))
      setTestLog(results.join(' · ')); setTestLogType(d.fcm?.ok || d.ntfy?.ok ? 'ok' : 'err')
    } catch(e: any) {
      setTestLog('Erro: ' + e.message); setTestLogType('err')
    } finally { setSending(false) }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, background: active ? '#eff6ff' : '#f8fafc',
    border: `1.5px solid ${active ? '#93c5fd' : '#e2e8f2'}`,
    borderRadius: '8px', padding: '7px 8px', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', color: active ? '#2563eb' : '#64748b', transition: 'all .15s',
    textAlign: 'center' as const,
  })

  const prioBtn = (p: string): React.CSSProperties => ({
    flex: 1, background: prio === p ? '#eff6ff' : '#f8fafc',
    border: `1.5px solid ${prio === p ? '#93c5fd' : '#e2e8f2'}`,
    borderRadius: '7px', padding: '5px 4px', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', color: prio === p ? '#2563eb' : '#64748b', transition: 'all .15s',
  })

  const qBtn: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
    background: '#f8fafc', border: '1px solid #e2e8f2', borderRadius: '9px',
    padding: '9px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    color: '#0f172a', transition: 'background .15s', marginBottom: '6px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* CALENDAR */}
      <Accordion id="cal" icon="📅" label="Calendário" defaultOpen={true}>
        <div style={{ padding: '14px' }}>
          <Calendar vagas={vagas} />
        </div>
      </Accordion>

      {/* QUICK ACTIONS */}
      <Accordion id="acoes" icon="⚡" label="Ações rápidas" defaultOpen={true}>
        <div style={{ padding: '10px' }}>
          <button style={qBtn} onClick={() => window.open('https://www.gcmdeac.prefeitura.sp.gov.br', '_blank')}>
            🌐 Abrir site DEAC
          </button>
          <button style={qBtn} onClick={onRunCheck}>
            🔄 Verificar agora
          </button>
          <button
            onClick={onTogglePush}
            style={{ ...qBtn, marginBottom: '6px', color: isPushActive ? '#059669' : '#64748b', borderColor: isPushActive ? '#bbf7d0' : '#e2e8f2', background: isPushActive ? '#f0fdf4' : '#f8fafc' }}
          >
            {isPushActive ? '🔔 Notificações ativas ✓' : '🔔 Ativar notificações'}
          </button>
          <button style={{ ...qBtn, marginBottom: 0, color: '#dc2626' }} onClick={onClearSnapshot}>
            🗑️ Resetar snapshot
          </button>
        </div>
      </Accordion>

      {/* TEST PANEL */}
      <Accordion id="test" icon="📡" label="Enviar teste" defaultOpen={false}>
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            value={testTitle} onChange={e => setTestTitle(e.target.value)}
            placeholder="Título"
            style={{ width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f2', borderRadius: '8px', padding: '8px 11px', fontSize: '13px', fontFamily: 'DM Mono, monospace', color: '#0f172a', outline: 'none' }}
          />
          <textarea
            value={testBody} onChange={e => setTestBody(e.target.value)}
            placeholder="Mensagem..."
            style={{ width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f2', borderRadius: '8px', padding: '8px 11px', fontSize: '13px', fontFamily: 'DM Mono, monospace', color: '#0f172a', outline: 'none', resize: 'vertical', minHeight: '60px' }}
          />
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>Canal</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={btnStyle(channels.fcm)} onClick={() => toggleCh('fcm')}>📲 PWA</button>
            <button style={btnStyle(channels.ntfy)} onClick={() => toggleCh('ntfy')}>🔔 ntfy</button>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>Prioridade</div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['default', 'high', 'urgent'] as const).map(p => (
              <button key={p} style={prioBtn(p)} onClick={() => setPrio(p)}>
                {p === 'default' ? 'Normal' : p === 'high' ? 'Alta' : '🚨 Urgente'}
              </button>
            ))}
          </div>
          <button
            onClick={sendTest} disabled={sending}
            style={{ width: '100%', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '9px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}
          >
            {sending ? '⏳ Enviando...' : '▶ Enviar'}
          </button>
          {testLog && (
            <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: testLogType === 'ok' ? '#059669' : testLogType === 'err' ? '#dc2626' : '#64748b' }}>
              {testLog}
            </div>
          )}
        </div>
      </Accordion>

      {/* HISTORICO */}
      <Accordion id="hist" icon="🔔" label="Notificações" badge={historico.length} defaultOpen={true}>
        <div style={{ padding: '8px' }}>
          {historico.length === 0
            ? <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '16px' }}>Nenhuma notificação ainda.</div>
            : historico.map((h, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f2', borderRadius: '9px', padding: '9px 11px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{h.data} {(h.hora || '').substring(0,5)}</span>
                  <span style={{ marginLeft: 'auto', background: '#10b981', color: '#fff', borderRadius: '5px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>+{h.atual - h.anterior}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {h.diaSemana} — {h.posto || ''}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{fmtTs(h.ts)}</div>
              </div>
            ))
          }
        </div>
      </Accordion>

    </div>
  )
}
