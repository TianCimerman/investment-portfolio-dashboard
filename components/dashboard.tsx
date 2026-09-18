'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, LogOut, Plus, RefreshCw, Trash2, WalletCards } from 'lucide-react'
import type { Holding, LiveQuote } from '@/lib/portfolio'

type Props = { user: { username: string }; initialHoldings: Holding[] }
type EnrichedHolding = Holding & { price: number; value: number; change: number | null }
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })
const displayType = (type: Holding['assetType']) => type === 'etf' ? 'ETF' : type[0].toUpperCase() + type.slice(1)

export function Dashboard({ user, initialHoldings }: Props) {
  const [holdings, setHoldings] = useState(initialHoldings)
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const [quoteError, setQuoteError] = useState('')
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState('')
  const [activePage, setActivePage] = useState<'Overview' | 'Holdings'>('Overview')

  const refreshQuotes = useCallback(async (currentHoldings = holdings) => {
    if (!currentHoldings.length) { setQuotes({}); return }
    setLoadingQuotes(true)
    try {
      const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(currentHoldings.map((holding) => holding.symbol).join(','))}`)
      const body = await response.json() as { quotes?: Record<string, LiveQuote>; error?: string }
      if (body.quotes) setQuotes((previous) => ({ ...previous, ...body.quotes }))
      if (!response.ok) throw new Error(body.error ?? 'Unable to refresh live prices.')
      setQuoteError('')
    } catch (error) { setQuoteError(error instanceof Error ? error.message : 'Unable to refresh live prices.') } finally { setLoadingQuotes(false) }
  }, [holdings])

  useEffect(() => {
    void refreshQuotes()
    const interval = window.setInterval(() => void refreshQuotes(), 60_000)
    return () => window.clearInterval(interval)
  }, [refreshQuotes])

  const enriched = useMemo<EnrichedHolding[]>(() => holdings.map((holding) => {
    const quote = quotes[holding.symbol]
    const price = quote?.price ?? holding.averageBuyPrice
    const change = quote?.previousClose ? ((price - quote.previousClose) / quote.previousClose) * 100 : null
    return { ...holding, price, value: holding.quantity * price, change }
  }), [holdings, quotes])

  const totals = useMemo(() => {
    const value = enriched.reduce((sum, holding) => sum + holding.value, 0)
    const cost = enriched.reduce((sum, holding) => sum + holding.quantity * holding.averageBuyPrice, 0)
    const daily = enriched.reduce((sum, holding) => holding.change === null ? sum : sum + holding.quantity * (holding.price - (quotes[holding.symbol]?.previousClose ?? holding.price)), 0)
    return { value, cost, totalReturn: value - cost, daily }
  }, [enriched, quotes])

  const allocation = useMemo(() => (['crypto', 'stock', 'etf'] as const).map((type) => {
    const value = enriched.filter((holding) => holding.assetType === type).reduce((sum, holding) => sum + holding.value, 0)
    return { type, value, percentage: totals.value ? (value / totals.value) * 100 : 0 }
  }).filter((item) => item.value > 0), [enriched, totals.value])

  async function addHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError('')
    const form = new FormData(event.currentTarget)
    const payload = { symbol: form.get('symbol'), name: form.get('name'), assetType: form.get('assetType'), quantity: form.get('quantity'), averageBuyPrice: form.get('averageBuyPrice') }
    const response = await fetch('/api/holdings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = await response.json() as { holding?: Holding; error?: string }
    if (!response.ok || !body.holding) { setFormError(body.error ?? 'Unable to add holding.'); return }
    const next = [body.holding, ...holdings]
    setHoldings(next); setAdding(false); event.currentTarget.reset(); void refreshQuotes(next)
  }

  async function removeHolding(id: number) {
    if (!window.confirm('Remove this holding from your portfolio?')) return
    const response = await fetch(`/api/holdings/${id}`, { method: 'DELETE' })
    if (response.ok) setHoldings((current) => current.filter((holding) => holding.id !== id))
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login') }
  const totalReturnPercent = totals.cost ? (totals.totalReturn / totals.cost) * 100 : 0

  return <main className="dashboard-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>northstar</span></div><div className="workspace-label">PERSONAL WORKSPACE</div><nav className="main-nav" aria-label="Main navigation"><button className={`nav-item ${activePage === 'Overview' ? 'active' : ''}`} onClick={() => setActivePage('Overview')}><BarChart3 size={18} /><span>Overview</span></button><button className={`nav-item ${activePage === 'Holdings' ? 'active' : ''}`} onClick={() => setActivePage('Holdings')}><WalletCards size={18} /><span>Holdings</span><span className="nav-count">{holdings.length}</span></button></nav><div className="sidebar-bottom"><button className="nav-item" onClick={logout}><LogOut size={18} /><span>Sign out</span></button><div className="user-card"><div className="avatar">{user.username.slice(0, 2).toUpperCase()}</div><div><strong>{user.username}</strong><span>Personal account</span></div></div></div></aside><section className="dashboard-content"><header className="topbar"><div className="breadcrumb"><span className="muted">Workspace</span><span>/</span><strong>{activePage}</strong></div><button className="date-button" onClick={() => void refreshQuotes()} disabled={loadingQuotes}><RefreshCw size={15} className={loadingQuotes ? 'spin' : ''} />{loadingQuotes ? 'Refreshing…' : 'Refresh live prices'}</button></header><div className="page-wrap"><div className="page-heading"><div><p className="eyebrow">PERSONAL PORTFOLIO</p><h1>{activePage === 'Overview' ? `Good morning, ${user.username}` : 'Your holdings'}</h1></div><button className="primary-action" onClick={() => { setAdding((open) => !open); setFormError('') }}><Plus size={15} /> Add holding</button></div>{quoteError && <div className="live-notice"><strong>Live prices unavailable.</strong> {quoteError} <span>Your saved cost basis is shown until prices can refresh.</span></div>}{adding && <form className="add-holding-form" onSubmit={addHolding}><div><label>Symbol<input name="symbol" placeholder="AAPL or BTC/USD" required /></label><label>Name<input name="name" placeholder="Apple Inc." required /></label></div><div><label>Asset type<select name="assetType" defaultValue="stock"><option value="stock">Stock</option><option value="etf">ETF</option><option value="crypto">Crypto</option></select></label><label>Quantity<input name="quantity" type="number" min="0" step="any" required /></label><label>Average buy price (USD)<input name="averageBuyPrice" type="number" min="0" step="any" required /></label><button className="primary-action" type="submit">Save holding</button></div>{formError && <p className="form-error">{formError}</p>}<p className="form-help">Use Twelve Data symbols. Crypto pairs use the format <code>BTC/USD</code>.</p></form>}{activePage === 'Overview' && <><section className="metric-grid"><Metric label="Total portfolio value" value={money.format(totals.value)} /><Metric label="Today’s return" value={money.format(totals.daily)} tone={totals.daily >= 0 ? 'positive' : 'negative'} /><Metric label="Total return" value={money.format(totals.totalReturn)} tone={totals.totalReturn >= 0 ? 'positive' : 'negative'} detail={`${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%`} /><Metric label="Positions" value={String(holdings.length)} detail="Saved locally" /></section><div className="section-grid top-grid"><section className="card performance-card"><div className="card-header"><div><h2>Portfolio performance</h2><p>Current market value against your cost basis</p></div></div><div className="portfolio-bars"><div><span>Current value</span><b>{money.format(totals.value)}</b><i><em style={{ width: totals.value ? '100%' : '0%' }} /></i></div><div><span>Cost basis</span><b>{money.format(totals.cost)}</b><i><em className="cost-bar" style={{ width: totals.value ? `${Math.min(100, (totals.cost / totals.value) * 100)}%` : '0%' }} /></i></div></div></section><section className="card allocation-card"><div className="card-header"><div><h2>Asset allocation</h2><p>By market value</p></div></div><div className="allocation-legend allocation-list">{allocation.length ? allocation.map((item) => <div key={item.type}><span className={`legend-dot ${item.type === 'crypto' ? 'crypto' : item.type === 'stock' ? 'stocks' : 'etfs'}`} /><div><strong>{displayType(item.type)}</strong><small>{money.format(item.value)}</small></div><b>{item.percentage.toFixed(1)}%</b></div>) : <p className="empty-copy">Add your first holding to see allocation.</p>}</div></section></div></>}<section className="card holdings-card functional-holdings"><div className="card-header holdings-heading"><div><h2>{activePage === 'Overview' ? 'Holdings' : 'All holdings'}</h2><p>{holdings.length ? `${holdings.length} saved position${holdings.length === 1 ? '' : 's'}` : 'No positions saved yet'}</p></div><span className="muted">{Object.keys(quotes).length ? 'Live quotes update every minute' : 'Saved values'}</span></div>{enriched.length ? <div className="table-scroll"><table><thead><tr><th>ASSET</th><th>QUANTITY</th><th>AVG. BUY PRICE</th><th>LIVE PRICE</th><th>CHANGE</th><th>TOTAL VALUE</th><th /></tr></thead><tbody>{enriched.map((holding) => <tr key={holding.id}><td><div className="asset-cell"><span className={`asset-mark ${holding.assetType === 'crypto' ? 'orange' : holding.assetType === 'etf' ? 'teal' : 'blue'}`}>{holding.symbol.slice(0, 1)}</span><div><strong>{holding.name}</strong><span>{holding.symbol} · {displayType(holding.assetType)}</span></div></div></td><td className="number-cell">{number.format(holding.quantity)}</td><td className="number-cell">{money.format(holding.averageBuyPrice)}</td><td className="number-cell">{money.format(holding.price)}</td><td>{holding.change === null ? <span className="muted">—</span> : <span className={`change-pill ${holding.change >= 0 ? 'positive' : 'negative'}`}>{holding.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{holding.change.toFixed(2)}%</span>}</td><td className="value-cell">{money.format(holding.value)}</td><td><button className="row-menu delete-button" onClick={() => void removeHolding(holding.id)} aria-label={`Remove ${holding.name}`}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><CircleDollarSign size={24} /><h2>Your portfolio starts here</h2><p>Add a stock, ETF, or crypto holding. It will be stored privately in your local SQLite database.</p><button className="primary-action" onClick={() => setAdding(true)}><Plus size={15} /> Add your first holding</button></div>}</section></div></section></main>
}

function Metric({ label, value, tone, detail }: { label: string; value: string; tone?: 'positive' | 'negative'; detail?: string }) {
  return <div className="metric-card"><div className="metric-label">{label.toUpperCase()}</div><div className={`small-metric-value ${tone ?? ''}`}>{value}</div>{detail && <div className={`small-change ${tone ?? 'muted'}`}>{detail}</div>}</div>
}
