'use client'
import { useState, useEffect, useCallback } from 'react'
import { DadosAPI, Vaga } from '@/lib/types'
import { groupVagasByDate, fmtTs } from '@/lib/utils'
import Login from '@/components/Login'
import Sidebar from '@/components/Sidebar'
import DateCard from '@/components/DateCard'

const VAPID_PUB = 'BGkAhffgOmpXgLJPuYOYgYy50QGcRkQ5M7WrRup3ALYh8Ij9Qjc_atcN2DOU_0BWpqv5YAFroHw6ENFW17fTWWc'
const FB_CONFIG = {
  apiKey: 'AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo',
  authDomain: 'deac-monitor.firebaseapp.com',
  projectId: 'deac-monitor',
  storageBucket: 'deac-monitor.firebasestorage.app',
  messagingSenderId: '721222526794',
  appId: '1:721222526794:web:a27fd0a5be737f815983b3',
}

const FILTERS = ['Todas', 'Com vagas', '06h', '11h', '13h', '⭐ Prio']
const FILTERS_KEY = ['todas', 'disponiveis', '06h', '11h', '13h', 'priority']

export default function Dashboard() {
  const [authed, setAuthed] = useState(false)
  const [dados, setDados] = useState<DadosAPI | null>(null)
  const [filter, setFilter] = useState('todas')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState('')
  const [toastIcon, setToastIcon] = useState('✅')
  const [now, setNow] = useState(new Date())
  const [pushActive, setPushActive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const WORKER = process.env.NEXT_PUBLIC_WORKER_URL || ''

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') === '1') {
      setAuthed(true)
    }
  }, [])

  // Push status
  useEffect(() => {
    if (!authed || typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setPushActive(!!sub)
    }).catch(() => {})
  }, [authed])

  // Register SW
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

  const showToast = (msg: string, icon = '✅') => {
    setToast(msg); setToastIcon(icon)
    setTimeout(() => setToast(''), 3500)
  }

  const loadData = useCallback(async () => {
    if (!WORKER) return
    setLoading(true)
    try {
      const r = await fetch(`${WORKER}/data`)
      const d: DadosAPI = await r.json()
      setDados(d)
    } catch { showToast('Erro ao carregar dados', '❌') }
    finally { setLoading(false) }
  }, [WORKER])

  const runCheck = async () => {
    if (!WORKER) return
    setChecking(true)
    try {
      const r = await fetch(`${WORKER}/api`)
      const d = await r.json()
      setDados(prev => prev ? { ...prev, vagas: d.vagas || [], ultimoCheck: { ts: d.ts, total: d.vagas?.length || 0 } } : null)
      const total = (d.vagas || []).reduce((s: number, v: Vaga) => s + v.vagasRem, 0)
      if (d.alertas?.length > 0) showToast(`${d.alertas.length} nova(s) vaga(s)!`, '🚨')
      else showToast(`Verificado — ${total} vagas disponíveis`, '✅')
      await loadData()
    } catch { showToast('Erro na verificação', '❌') }
    finally { setChecking(false) }
  }

  const clearSnapshot = async () => {
    if (!confirm('Resetar snapshot? O próximo check re-notificará todas as vagas.')) return
    try { await fetch(`${WORKER}/clear-snapshot`, { method: 'POST' }); showToast('Snapshot resetado!', '🗑️') }
    catch { showToast('Erro ao resetar', '❌') }
  }

  const togglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { showToast('Push não suportado', '❌'); return }
    try {
      let reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await existing.unsubscribe()
        await fetch(`${WORKER}/push-subscribe`, { method: 'DELETE' })
        setPushActive(false); showToast('Notificações desativadas', '🔕')
      } else {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { showToast('Permissão negada', '❌'); return }
        let fcmToken: string | null = null
        try {
          // @ts-ignore
          const { firebase } = window as any
          if (firebase) {
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG)
            const msg = firebase.messaging(app)
            fcmToken = await msg.getToken({ vapidKey: VAPID_PUB, serviceWorkerRegistration: reg })
          }
        } catch {}
        let body: string
        if (fcmToken) {
          body = JSON.stringify({ fcmToken })
        } else {
          const pad = '='.repeat((4 - VAPID_PUB.length % 4) % 4)
          const raw = atob(VAPID_PUB.replace(/-/g, '+').replace(/_/g, '/') + pad)
          const key = new Uint8Array(raw.length)
          for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i)
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
          body = JSON.stringify(sub.toJSON())
        }
        const r = await fetch(`${WORKER}/push-subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        const res = await r.json()
        if (res.ok) { setPushActive(true); showToast(`Notificações ativadas! ${fcmToken ? '(FCM)' : '(WebPush)'}`, '🔔') }
        else showToast('Erro ao ativar push', '❌')
      }
    } catch(e: any) { showToast('Erro: ' + e.message, '❌') }
  }

  // Load on auth
  useEffect(() => { if (authed) loadData() }, [authed, loadData])
  useEffect(() => {
    if (!authed) return
    const t = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [authed, loadData])

  // Filter vagas
  const vagas = dados?.vagas || []
  const filtered = vagas.filter(v => {
    if (filter === 'disponiveis') return v.vagasRem > 0
    if (filter === 'priority') return (v.hora?.startsWith('06:') && ['Segunda-Feira','Terca-Feira','Quarta-Feira','Quinta-Feira','Sexta_Feira'].includes(v.diaSemana))
    if (filter === '06h') return v.hora?.startsWith('06:')
    if (filter === '11h') return v.hora?.startsWith('11:')
    if (filter === '13h') return v.hora?.startsWith('13:')
    return true
  })
  const groups = groupVagasByDate(filtered)
  const totalDisp = vagas.reduce((s, v) => s + v.vagasRem, 0)

  // Date/time
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (!authed) return <Login onLogin={() => { setAuthed(true) }} />

  return (
    <>
      {/* Firebase scripts */}
      <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js" async />
      <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js" async />

      {/* Loading bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 500,
        background: (loading || checking) ? '#2563eb' : 'transparent',
        transition: 'background .3s',
      }} />

      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100, height: '60px',
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f2',
        display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
      }}>
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          style={{ display: 'none', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#475569' }}
          className="mobile-menu-btn"
        >
          ☰
        </button>

        <img src="https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png" alt="GCM" style={{ height: '32px', objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>Monitor CETEL</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Sistema de Escala</div>
        </div>

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{dateStr}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
            Atualizado às {dados?.ultimoCheck ? fmtTs(dados.ultimoCheck.ts).split(' ')[1] : timeStr}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
          <button
            onClick={loadData} disabled={loading}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f2', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}
          >
            {loading ? '⏳' : '↻'} Atualizar
          </button>
          <button
            onClick={() => {}}
            title="Notificações"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f2', borderRadius: '8px', padding: '6px 10px', fontSize: '14px', cursor: 'pointer', position: 'relative' }}
          >
            🔔
            {dados?.historico?.length ? (
              <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#2563eb', color: '#fff', borderRadius: '10px', fontSize: '9px', fontWeight: 700, padding: '0 4px', minWidth: '14px', textAlign: 'center' }}>
                {dados.historico.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('auth'); setAuthed(false) }}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f2', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            → Sair
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>

        {/* SIDEBAR — desktop fixed, mobile overlay */}
        <aside style={{
          width: '260px', flexShrink: 0, background: '#f8fafc',
          borderRight: '1px solid #e2e8f2', padding: '16px 12px',
          overflowY: 'auto', position: 'sticky', top: '60px', height: 'calc(100vh - 60px)',
        }}>
          <Sidebar
            vagas={vagas}
            historico={dados?.historico || []}
            onRunCheck={runCheck}
            onClearSnapshot={clearSnapshot}
            isPushActive={pushActive}
            onTogglePush={togglePush}
          />
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '20px', overflowY: 'auto', minWidth: 0 }}>
          {/* Page title + stats */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>Vagas Disponíveis</h1>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{dados?.mes || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: 'Total disponível', value: totalDisp, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                { label: 'Datas com vaga', value: groups.filter(g => g.totalRem > 0).length, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'DM Mono, monospace', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
              <button
                onClick={runCheck} disabled={checking}
                style={{
                  background: checking ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none',
                  borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 700,
                  cursor: checking ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif',
                  boxShadow: '0 2px 8px rgba(37,99,235,.3)',
                }}
              >
                {checking ? '⏳ Verificando...' : '▶ Verificar'}
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {FILTERS.map((f, i) => (
              <button
                key={f}
                onClick={() => setFilter(FILTERS_KEY[i])}
                style={{
                  background: filter === FILTERS_KEY[i] ? '#2563eb' : '#fff',
                  color: filter === FILTERS_KEY[i] ? '#fff' : '#64748b',
                  border: `1px solid ${filter === FILTERS_KEY[i] ? '#2563eb' : '#e2e8f2'}`,
                  borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Vagas list */}
          {groups.length === 0
            ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px', background: '#fff', borderRadius: '14px', border: '1px dashed #e2e8f2' }}>
                Nenhuma vaga encontrada.
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {groups.map((g, i) => <DateCard key={g.data} group={g} delay={i * 0.04} />)}
              </div>
          }
        </main>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', borderRadius: '12px', padding: '11px 18px',
          fontSize: '13px', fontWeight: 600, zIndex: 300, whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,.2)', animation: 'fadeUp .25s ease',
        }}>
          {toastIcon} {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes fadeUp2 { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        [style*="animation"] { animation-fill-mode: both; }
        @media (max-width: 768px) {
          aside { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (max-width: 480px) {
          header { padding: 0 12px !important; }
          header > div:nth-child(4) { display: none !important; }
          main { padding: 12px !important; }
        }
        * { scrollbar-width: thin; scrollbar-color: #e2e8f2 transparent; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f2; border-radius: 10px; }
      `}</style>
    </>
  )
}
