'use client'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  const isRegister = mode === 'register'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setPending(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch(`/api/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Something went wrong.')
      window.location.assign('/')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong.') } finally { setPending(false) }
  }
  return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><span /></span><span>northstar</span></div><p className="eyebrow">PERSONAL PORTFOLIO</p><h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1><p className="auth-copy">{isRegister ? 'Your portfolio data stays in this app’s local database.' : 'Sign in to see your personal portfolio.'}</p><form onSubmit={submit} className="auth-form"><label>Username<input name="username" autoComplete="username" minLength={3} maxLength={32} required /></label><label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={10} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-action auth-submit" disabled={pending}>{pending ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New here?'} <Link href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></section></main>
}
