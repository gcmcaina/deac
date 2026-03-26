'use client'
import { useState } from 'react'

const USERS: Record<string, string> = { deac: 'deac99' }

interface LoginProps { onLogin: () => void }

export default function Login({ onLogin }: LoginProps) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  function handleLogin() {
    if (USERS[user] && USERS[user] === pass) {
      sessionStorage.setItem('auth', '1')
      onLogin()
    } else {
      setErr('Usuário ou senha incorretos.')
      setPass('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#1d4ed8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', background: '#fff', borderRadius: '20px',
        padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,.25)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png"
            alt="GCM" style={{ height: '52px', objectFit: 'contain' }}
          />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>Monitor CETEL</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Sistema de Escala — GCM</div>
        </div>

        {/* Fields */}
        {[
          { label: 'Usuário', val: user, set: setUser, type: 'text', ph: 'deac' },
          { label: 'Senha', val: pass, set: setPass, type: 'password', ph: '••••••' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginBottom: '5px' }}>
              {f.label}
            </label>
            <input
              type={f.type} value={f.val} placeholder={f.ph}
              onChange={e => f.set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                borderRadius: '10px', padding: '11px 14px', fontSize: '14px',
                fontFamily: 'DM Mono, monospace', color: '#0f172a', outline: 'none',
              }}
            />
          </div>
        ))}

        <button
          onClick={handleLogin}
          style={{
            width: '100%', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: '#fff', border: 'none', borderRadius: '10px', padding: '13px',
            fontSize: '15px', fontFamily: 'Outfit, sans-serif', fontWeight: 700,
            cursor: 'pointer', marginTop: '4px', boxShadow: '0 4px 14px rgba(37,99,235,.4)',
          }}
        >
          Entrar
        </button>

        {err && <div style={{ color: '#dc2626', fontSize: '12px', textAlign: 'center', marginTop: '12px' }}>{err}</div>}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#94a3b8' }}>
          Guarda Civil Metropolitana · SP
        </div>
      </div>
    </div>
  )
}
