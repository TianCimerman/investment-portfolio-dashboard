'use client'

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Bitcoin, Building2, ChartNoAxesCombined, Coins, Download, LogOut, Menu, Plus, ReceiptText, RefreshCw, Star, Trash2, WalletCards, X } from 'lucide-react'
import type { Holding, LiveQuote, PortfolioTransaction, WatchlistItem } from '@/lib/portfolio'

type Props = { user: { username: string }; initialHoldings: Holding[]; initialTransactions: PortfolioTransaction[]; initialWatchlist: WatchlistItem[] }
type Page = 'Overview' | 'Holdings' | 'Transactions' | 'Watchlist'
const currency = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const compactCurrency = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
const quantities = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 })
const today = () => new Date().toISOString().slice(0, 10)
const typeName = (type: Holding['assetType']) => type === 'etf' ? 'ETF' : type[0].toUpperCase() + type.slice(1)
const marketSymbol = (asset: Pick<Holding, 'assetType' | 'symbol'>) => asset.assetType === 'crypto' ? `${asset.symbol.split('/')[0]}/EUR` : asset.symbol

const quoteLabel = (quote: LiveQuote | undefined, unavailableLabel = 'Saved cost basis') => quote ? quote.freshness === 'live' ? `Live · ${quote.source === 'coingecko' ? 'CoinGecko' : 'Twelve Data'}` : 'Latest close · EODHD' : unavailableLabel

export function PortfolioDashboard({ user, initialHoldings, initialTransactions, initialWatchlist }: Props) {
  const [holdings, setHoldings] = useState(initialHoldings)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const [activePage, setActivePage] = useState<Page>('Overview')
  const [selectedCalendarYear, setSelectedCalendarYear] = useState(() => new Date().getFullYear() - 1)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [watchlistFormOpen, setWatchlistFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [quoteError, setQuoteError] = useState('')
  const [ledgerError, setLedgerError] = useState('')
  const [holdingError, setHoldingError] = useState('')
  const [watchlistError, setWatchlistError] = useState('')
  const [selectedTaxTransaction, setSelectedTaxTransaction] = useState<PortfolioTransaction | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refreshQuotes = useCallback(async (items = holdings, watchlistItems = watchlist) => {
    if (!items.length && !watchlistItems.length) { setQuotes({}); return }
    setRefreshing(true)
    try {
      const assets = [...items.map((item) => `${item.assetType}:${marketSymbol(item)}`), ...watchlistItems.map((item) => `${item.assetType}:${marketSymbol(item)}`), 'forex:USD/EUR']
      const response = await fetch(`/api/quotes?assets=${encodeURIComponent([...new Set(assets)].join(','))}`)
      const body = await response.json() as { quotes?: Record<string, LiveQuote>; error?: string }
      if (body.quotes) setQuotes((current) => ({ ...current, ...body.quotes }))
      if (!response.ok) throw new Error(body.error ?? 'Unable to refresh live prices.')
      setQuoteError('')
    } catch (error) { setQuoteError(error instanceof Error ? error.message : 'Unable to refresh live prices.') } finally { setRefreshing(false) }
  }, [holdings, watchlist])

  useEffect(() => {
    void refreshQuotes()
    const timer = window.setInterval(() => void refreshQuotes(), 60_000)
    return () => window.clearInterval(timer)
  }, [refreshQuotes])

  const positions = useMemo(() => holdings.map((holding) => {
    const quote = quotes[marketSymbol(holding)]
    const usdToEur = quotes['USD/EUR']?.price
    const conversion = quote?.currency === 'EUR' ? 1 : usdToEur ?? 1
    const price = quote ? quote.price * conversion : holding.averageBuyPrice
    const previousClose = quote?.previousClose ? quote.previousClose * conversion : null
    const change = previousClose ? ((price - previousClose) / previousClose) * 100 : null
    return { ...holding, price, change, value: holding.quantity * price, quote }
  }), [holdings, quotes])
  const totals = useMemo(() => {
    const value = positions.reduce((sum, item) => sum + item.value, 0)
    const cost = positions.reduce((sum, item) => sum + item.quantity * item.averageBuyPrice, 0)
    return { value, cost, returnValue: value - cost }
  }, [positions])
  const allocation = useMemo(() => (['crypto', 'stock', 'etf'] as const).map((assetType) => {
    const value = positions.filter((item) => item.assetType === assetType).reduce((sum, item) => sum + item.value, 0)
    return { assetType, value, percentage: totals.value ? value / totals.value * 100 : 0 }
  }).filter((item) => item.value > 0), [positions, totals.value])
  const calendarYears = useMemo(() => [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, ...transactions.map((transaction) => Number(transaction.transactionDate.slice(0, 4))).filter(Number.isInteger)])].sort((left, right) => right - left), [transactions])
  const selectedCalendarYearTransactions = useMemo(() => transactions.filter((transaction) => transaction.transactionDate >= `${selectedCalendarYear}-01-01` && transaction.transactionDate <= `${selectedCalendarYear}-12-31`), [transactions, selectedCalendarYear])
  const selectedCalendarYearTransactionValue = useMemo(() => selectedCalendarYearTransactions.reduce((total, transaction) => total + transaction.quantity * transaction.unitPrice, 0), [selectedCalendarYearTransactions])

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError('')
    const form = event.currentTarget
    const data = new FormData(form)
    const response = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: data.get('type'), symbol: data.get('symbol'), name: data.get('name'), assetType: data.get('assetType'), quantity: data.get('quantity'), unitPrice: data.get('unitPrice'), transactionDate: data.get('transactionDate'), notes: data.get('notes') }) })
    const result = await response.json() as { transaction?: PortfolioTransaction; holdings?: Holding[]; error?: string }
    if (!response.ok || !result.transaction || !result.holdings) { setFormError(result.error ?? 'Unable to save transaction.'); return }
    setTransactions((current) => [result.transaction!, ...current])
    setHoldings(result.holdings)
    form.reset(); setFormOpen(false); void refreshQuotes(result.holdings)
  }

  async function removeTransaction(transactionId: number) {
    if (!window.confirm('Remove this transaction? This will also update the matching holding.')) return
    setLedgerError('')
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, { method: 'DELETE' })
      const result = await response.json() as { holdings?: Holding[]; error?: string }
      if (!response.ok || !result.holdings) throw new Error(result.error ?? 'Unable to remove transaction.')
      setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId))
      setHoldings(result.holdings)
      void refreshQuotes(result.holdings)
    } catch (error) { setLedgerError(error instanceof Error ? error.message : 'Unable to remove transaction.') }
  }

  async function removeHolding(holding: Holding) {
    if (!window.confirm(`Remove ${holding.symbol} from your portfolio? This also removes all of its matching transactions.`)) return
    setHoldingError('')
    try {
      const response = await fetch(`/api/holdings/${holding.id}`, { method: 'DELETE' })
      const result = await response.json() as { holdings?: Holding[]; symbol?: string; assetType?: Holding['assetType']; error?: string }
      if (!response.ok || !result.holdings || !result.symbol || !result.assetType) throw new Error(result.error ?? 'Unable to remove holding.')
      setHoldings(result.holdings)
      setTransactions((current) => current.filter((transaction) => transaction.symbol !== result.symbol || transaction.assetType !== result.assetType))
      void refreshQuotes(result.holdings)
    } catch (error) { setHoldingError(error instanceof Error ? error.message : 'Unable to remove holding.') }
  }

  async function saveWatchlistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWatchlistError('')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const response = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: data.get('symbol'), name: data.get('name'), assetType: data.get('assetType') }) })
      const result = await response.json() as { item?: WatchlistItem; error?: string }
      if (!response.ok || !result.item) throw new Error(result.error ?? 'Unable to add watchlist asset.')
      const nextWatchlist = [result.item, ...watchlist]
      setWatchlist(nextWatchlist)
      form.reset(); setWatchlistFormOpen(false); void refreshQuotes(holdings, nextWatchlist)
    } catch (error) { setWatchlistError(error instanceof Error ? error.message : 'Unable to add watchlist asset.') }
  }

  async function removeWatchlistItem(itemId: number) {
    setWatchlistError('')
    try {
      const response = await fetch(`/api/watchlist/${itemId}`, { method: 'DELETE' })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Unable to remove watchlist asset.')
      setWatchlist((current) => current.filter((item) => item.id !== itemId))
    } catch (error) { setWatchlistError(error instanceof Error ? error.message : 'Unable to remove watchlist asset.') }
  }

  async function sellFromTransaction(source: PortfolioTransaction, form: FormData) {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sell',
          symbol: source.symbol,
          name: source.name,
          assetType: source.assetType,
          quantity: form.get('quantity'),
          unitPrice: form.get('unitPrice'),
          transactionDate: form.get('transactionDate'),
          notes: form.get('notes') || `Sold from ${source.transactionDate} purchase`,
        }),
      })
      const result = await response.json() as { transaction?: PortfolioTransaction; holdings?: Holding[]; error?: string }
      if (!response.ok || !result.transaction || !result.holdings) return result.error ?? 'Unable to record this sale.'
      setTransactions((current) => [result.transaction!, ...current])
      setHoldings(result.holdings)
      void refreshQuotes(result.holdings)
      return null
    } catch (error) { return error instanceof Error ? error.message : 'Unable to record this sale.' }
  }

  function downloadCsv(items = transactions) {
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const rows = [['Date', 'Type', 'Symbol', 'Asset name', 'Asset type', 'Quantity', 'Unit price EUR', 'Gross amount EUR', 'Notes'], ...items.map((item) => [item.transactionDate, item.type.toUpperCase(), item.symbol, item.name, typeName(item.assetType), item.quantity, item.unitPrice, item.quantity * item.unitPrice, item.notes])]
    const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), anchor = document.createElement('a')
    anchor.href = url; anchor.download = `northstar-transactions-${today()}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login') }
  function selectPage(page: Page) { setActivePage(page); setMobileMenuOpen(false) }
  const totalReturnPercent = totals.cost ? totals.returnValue / totals.cost * 100 : 0
  const pageTitle = activePage === 'Overview' ? `Good morning, ${user.username}` : activePage === 'Holdings' ? 'Your holdings' : activePage === 'Watchlist' ? 'Watchlist' : 'Transactions'

  return <main className="dashboard-shell">
    <aside id="mobile-navigation" className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><span /></span><span>Portfolio</span><button className="mobile-close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="workspace-label">PERSONAL WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <NavButton active={activePage === 'Overview'} onClick={() => selectPage('Overview')} icon={<BarChart3 size={18} />} label="Overview" />
        <NavButton active={activePage === 'Holdings'} onClick={() => selectPage('Holdings')} icon={<WalletCards size={18} />} label="Holdings" count={holdings.length} />
        <NavButton active={activePage === 'Transactions'} onClick={() => selectPage('Transactions')} icon={<ReceiptText size={18} />} label="Transactions" count={transactions.length} />
        <NavButton active={activePage === 'Watchlist'} onClick={() => selectPage('Watchlist')} icon={<Star size={18} />} label="Watchlist" count={watchlist.length} />
      </nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={logout}><LogOut size={18} /><span>Sign out</span></button><div className="user-card"><div className="avatar">{user.username.slice(0, 2).toUpperCase()}</div><div><strong>{user.username}</strong><span>Personal account</span></div></div></div>
    </aside>
    {mobileMenuOpen && <button className="mobile-nav-scrim" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />}
    <section className="dashboard-content">
      <header className="topbar"><button className="menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={mobileMenuOpen}><Menu size={21} /></button><div className="breadcrumb"><span className="muted">Workspace</span><span>/</span><strong>{activePage}</strong></div><button className="date-button" onClick={() => void refreshQuotes()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh market prices'}</button></header>
      <div className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow">PERSONAL PORTFOLIO</p><h1>{pageTitle}</h1></div>{activePage === 'Watchlist' ? <button className="primary-action" onClick={() => { setWatchlistFormOpen((open) => !open); setWatchlistError('') }}><Plus size={15} /> Add asset</button> : activePage !== 'Overview' && <button className="primary-action" onClick={() => { setFormOpen((open) => !open); setFormError('') }}><Plus size={15} /> Add transaction</button>}</div>
        {quoteError && <div className="live-notice"><strong>Market prices unavailable.</strong> {quoteError}</div>}
        {holdingError && <p className="form-error ledger-error">{holdingError}</p>}
        {watchlistError && <p className="form-error ledger-error">{watchlistError}</p>}
        {formOpen && activePage !== 'Overview' && activePage !== 'Watchlist' && <TransactionForm error={formError} onSubmit={saveTransaction} transactions={transactions} />}
        {watchlistFormOpen && activePage === 'Watchlist' && <WatchlistForm error={watchlistError} onSubmit={saveWatchlistItem} />}
        {activePage === 'Overview' && <Overview totals={totals} totalReturnPercent={totalReturnPercent} calendarYears={calendarYears} selectedCalendarYear={selectedCalendarYear} onCalendarYearChange={setSelectedCalendarYear} selectedCalendarYearTransactionValue={selectedCalendarYearTransactionValue} selectedCalendarYearTransactionCount={selectedCalendarYearTransactions.length} allocation={allocation} positionCount={positions.length} transactions={transactions} />}
        {activePage === 'Holdings' && <HoldingsTable positions={positions} onDelete={removeHolding} />}
        {activePage === 'Transactions' && <TransactionsTable transactions={transactions} onExport={downloadCsv} onDelete={removeTransaction} onSelect={setSelectedTaxTransaction} error={ledgerError} />}
        {activePage === 'Watchlist' && <WatchlistTable items={watchlist} quotes={quotes} onDelete={removeWatchlistItem} />}
        {activePage === 'Overview' && <TransactionsTable transactions={selectedCalendarYearTransactions} onExport={() => downloadCsv(selectedCalendarYearTransactions)} onDelete={removeTransaction} onSelect={setSelectedTaxTransaction} error={ledgerError} heading={`${selectedCalendarYear} transactions`} description={`Every buy and sell recorded from 1 January to 31 December ${selectedCalendarYear}.`} showControls={false} />}
      </div>
    </section>
    {selectedTaxTransaction && <TaxEstimateModal transactions={transactions} transaction={selectedTaxTransaction} quotes={quotes} onClose={() => setSelectedTaxTransaction(null)} onSell={sellFromTransaction} />}
  </main>
}

function NavButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}</button> }

function AssetIcon({ assetType, symbol }: Pick<Holding, 'assetType' | 'symbol'>) {
  const ticker = symbol.split(/[./:]/)[0].toUpperCase()
  const Icon = assetType === 'crypto' ? (ticker === 'BTC' ? Bitcoin : Coins) : assetType === 'etf' ? ChartNoAxesCombined : Building2
  const tone = assetType === 'crypto' ? 'orange' : assetType === 'etf' ? 'teal' : 'blue'
  return <span className={`asset-mark ${tone}`} title={`${typeName(assetType)} icon`} aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
}

function TransactionForm({ error, onSubmit, transactions }: { error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; transactions: PortfolioTransaction[] }) {
  function repeatTransaction(event: ChangeEvent<HTMLSelectElement>) {
    const transaction = transactions.find((item) => item.id === Number(event.currentTarget.value))
    const form = event.currentTarget.form
    if (!transaction || !form) return

    const setValue = (name: string, value: string) => {
      const field = form.elements.namedItem(name)
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value
    }

    setValue('type', transaction.type)
    setValue('symbol', transaction.symbol)
    setValue('name', transaction.name)
    setValue('assetType', transaction.assetType)
    setValue('quantity', String(transaction.quantity))
    setValue('unitPrice', String(transaction.unitPrice))
    setValue('notes', transaction.notes)
  }

  return <form className="add-holding-form transaction-form" onSubmit={onSubmit}>
    <div>
      <label>Repeat previous transaction<select defaultValue="" onChange={repeatTransaction}><option value="">Start a new transaction</option>{transactions.slice(0, 20).map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.transactionDate} · {transaction.type.toUpperCase()} · {transaction.symbol}</option>)}</select></label>
      <label>Type<select name="type" defaultValue="buy"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
      <label>Symbol<input name="symbol" placeholder="AAPL, BTC, or EUNL.XETRA" required /></label>
      <label>Asset name<input name="name" placeholder="Apple Inc." required /></label>
      <label>Asset type<select name="assetType" defaultValue="stock"><option value="stock">Stock</option><option value="etf">ETF</option><option value="crypto">Crypto</option></select></label>
    </div>
    <div>
      <label>Amount / quantity<input name="quantity" type="number" min="0" step="any" required /></label>
      <label>Unit buy/sell price (EUR)<input name="unitPrice" type="number" min="0" step="any" required /></label>
      <label>Date<input name="transactionDate" type="date" defaultValue={today()} required /></label>
      <label>Notes (optional)<input name="notes" maxLength={500} placeholder="Broker, fee, reference…" /></label>
      <button className="primary-action" type="submit">Save transaction</button>
    </div>
    {error && <p className="form-error">{error}</p>}
    <p className="form-help">Choose an earlier transaction to prefill the form; its date remains today. Each entry is retained separately for your records. For European listings, include the EODHD exchange suffix (for example, <code>EUNL.XETRA</code> or <code>CSPX.LSE</code>).</p>
  </form>
}

function WatchlistForm({ error, onSubmit }: { error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="add-holding-form watchlist-form" onSubmit={onSubmit}><div><label>Symbol<input name="symbol" placeholder="AAPL, BTC, or EUNL.XETRA" required /></label><label>Asset name<input name="name" placeholder="Apple Inc." required /></label><label>Asset type<select name="assetType" defaultValue="stock"><option value="stock">Stock</option><option value="etf">ETF</option><option value="crypto">Crypto</option></select></label><button className="primary-action" type="submit">Add to watchlist</button></div>{error && <p className="form-error">{error}</p>}<p className="form-help">Watchlist assets do not affect your portfolio totals. For European listings, include the EODHD suffix, for example <code>EUNL.XETRA</code>.</p></form> }

function WatchlistTable({ items, quotes, onDelete }: { items: WatchlistItem[]; quotes: Record<string, LiveQuote>; onDelete: (itemId: number) => void }) {
  if (!items.length) return <div className="empty-state"><Star size={24} /><h2>Your watchlist is empty</h2><p>Add stocks, ETFs, or crypto to follow their prices without adding them to your portfolio.</p></div>
  return <section className="card holdings-card functional-holdings"><div className="card-header holdings-heading"><div><h2>Tracked assets</h2><p>{items.length} asset{items.length === 1 ? '' : 's'} with live market pricing.</p></div></div><div className="table-scroll"><table><thead><tr><th>ASSET</th><th>ASSET TYPE</th><th>MARKET PRICE</th><th>CHANGE</th><th>QUOTE SOURCE</th><th /></tr></thead><tbody>{items.map((item) => {
    const quote = quotes[marketSymbol(item)]
    const conversion = quote?.currency === 'EUR' ? 1 : quotes['USD/EUR']?.price ?? 1
    const price = quote ? quote.price * conversion : null
    const previous = quote?.previousClose ? quote.previousClose * conversion : null
    const change = price && previous ? (price - previous) / previous * 100 : null
    return <tr key={item.id}><td><div className="asset-cell"><AssetIcon assetType={item.assetType} symbol={item.symbol} /><div><strong>{item.name}</strong><span>{item.symbol}</span></div></div></td><td>{typeName(item.assetType)}</td><td><strong className="quote-price">{price === null ? '—' : currency.format(price)}</strong></td><td>{change === null ? <span className="muted">—</span> : <span className={`change-pill ${change >= 0 ? 'positive' : 'negative'}`}>{change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change.toFixed(2)}%</span>}</td><td><small className="quote-source">{quoteLabel(quote, 'Quote unavailable')}</small></td><td><button className="row-menu delete-button" onClick={() => onDelete(item.id)} aria-label={`Remove ${item.symbol} from watchlist`}><Trash2 size={16} /></button></td></tr>
  })}</tbody></table></div></section>
}

function Overview({ totals, totalReturnPercent, calendarYears, selectedCalendarYear, onCalendarYearChange, selectedCalendarYearTransactionValue, selectedCalendarYearTransactionCount, allocation, positionCount, transactions }: { totals: { value: number; cost: number; returnValue: number }; totalReturnPercent: number; calendarYears: number[]; selectedCalendarYear: number; onCalendarYearChange: (year: number) => void; selectedCalendarYearTransactionValue: number; selectedCalendarYearTransactionCount: number; allocation: { assetType: Holding['assetType']; value: number; percentage: number }[]; positionCount: number; transactions: PortfolioTransaction[] }) { return <><div className="overview-year-picker"><label>Display year<select value={selectedCalendarYear} onChange={(event) => onCalendarYearChange(Number(event.target.value))}>{calendarYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div><section className="metric-grid"><Metric label="Total portfolio value" value={currency.format(totals.value)} /><Metric label="Cost basis" value={currency.format(totals.cost)} /><Metric label="Unrealized return · all time" value={currency.format(totals.returnValue)} tone={totals.returnValue >= 0 ? 'positive' : 'negative'} detail={`${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%`} /><Metric label={`Transaction value · ${selectedCalendarYear}`} value={currency.format(selectedCalendarYearTransactionValue)} detail={`${selectedCalendarYearTransactionCount} recorded transaction${selectedCalendarYearTransactionCount === 1 ? '' : 's'}`} /><Metric label="Open positions" value={String(positionCount)} detail="From your ledger" /></section><div className="section-grid top-grid"><PortfolioGrowth transactions={transactions} currentValue={totals.value} /><section className="card allocation-card"><div className="card-header"><div><h2>Asset allocation</h2><p>By current value</p></div></div><div className="allocation-legend allocation-list">{allocation.length ? allocation.map((item) => <div key={item.assetType}><span className={`legend-dot ${item.assetType === 'crypto' ? 'crypto' : item.assetType === 'stock' ? 'stocks' : 'etfs'}`} /><div><strong>{typeName(item.assetType)}</strong><small>{currency.format(item.value)}</small></div><b>{item.percentage.toFixed(1)}%</b></div>) : <p className="empty-copy">Add a transaction to see allocation.</p>}</div></section></div></> }

function PortfolioGrowth({ transactions, currentValue }: { transactions: PortfolioTransaction[]; currentValue: number }) {
  const [period, setPeriod] = useState<'all' | '1y' | '6m' | '3m'>('all')
  const allHistory = useMemo(() => {
    const dates = new Map<string, number>()
    for (const transaction of transactions) dates.set(transaction.transactionDate, (dates.get(transaction.transactionDate) ?? 0) + (transaction.type === 'buy' ? 1 : -1) * transaction.quantity * transaction.unitPrice)
    let invested = 0
    const points = [...dates.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([date, amount]) => ({ date, value: invested += amount }))
    if (points.length) {
      const finalDate = today()
      if (points.at(-1)?.date === finalDate) points[points.length - 1] = { date: finalDate, value: currentValue }
      else points.push({ date: finalDate, value: currentValue })
    }
    return points
  }, [transactions, currentValue])

  const history = useMemo(() => {
    if (!allHistory.length || period === 'all') return allHistory
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setMonth(cutoff.getMonth() - (period === '1y' ? 12 : period === '6m' ? 6 : 3))
    const cutoffDate = cutoff.toISOString().slice(0, 10)
    const beforeCutoff = allHistory.filter((point) => point.date < cutoffDate).at(-1)?.value ?? 0
    const visible = allHistory.filter((point) => point.date >= cutoffDate)
    return [{ date: cutoffDate, value: beforeCutoff }, ...visible]
  }, [allHistory, period])

  if (!history.length) return <section className="card performance-card"><div className="card-header"><div><h2>Portfolio growth</h2><p>Record dated transactions to see your portfolio history.</p></div></div><div className="growth-empty">Your growth chart will appear here after your first transaction.</div></section>

  const values = [0, ...history.map((item) => item.value)]
  const maximum = Math.max(...values, 1)
  const minimum = Math.min(...values, 0)
  const span = maximum - minimum || 1
  const x = (index: number) => history.length === 1 ? 100 : index / (history.length - 1) * 100
  const y = (value: number) => 100 - (value - minimum) / span * 100
  const chartPoints = history.map((item, index) => ({ x: x(index), y: y(item.value) }))
  const curve = chartPoints.reduce((path, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`
    const previous = chartPoints[index - 1]
    const midpoint = (previous.x + point.x) / 2
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`
  }, '')
  const area = `${curve} L 100 100 L 0 100 Z`
  const yAxis = [maximum, minimum + span / 2, minimum]
  const xAxis = [history[0], history[Math.floor((history.length - 1) / 2)], history.at(-1)!].map((item) => new Intl.DateTimeFormat('en-IE', { month: 'short', year: '2-digit' }).format(new Date(`${item.date}T00:00:00`)))
  const final = history.at(-1)!
  const netInvested = history.length > 1 ? history.at(-2)!.value : 0
  const change = final.value - netInvested

  return <section className="card performance-card"><div className="card-header"><div><h2>Portfolio growth</h2><p>Ledger contributions over time; the final point uses live market value.</p></div><div className="range-tabs" aria-label="Portfolio growth time period"><button className={period === 'all' ? 'selected' : ''} onClick={() => setPeriod('all')}>All</button><button className={period === '1y' ? 'selected' : ''} onClick={() => setPeriod('1y')}>1Y</button><button className={period === '6m' ? 'selected' : ''} onClick={() => setPeriod('6m')}>6M</button><button className={period === '3m' ? 'selected' : ''} onClick={() => setPeriod('3m')}>3M</button></div></div><div className="chart-stat"><span>{currency.format(currentValue)}</span><small className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? '+' : ''}{currency.format(change)} <em>vs. net invested</em></small></div><div className="performance-chart"><div className="chart-y-axis">{yAxis.map((value) => <span key={value}>{compactCurrency.format(value)}</span>)}</div><svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Portfolio growth chart"><defs><marker id="portfolio-growth-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth"><path className="growth-arrow" d="M 0 0 L 5 2.5 L 0 5 Z" /></marker></defs><g className="chart-grid"><line x1="0" y1="0" x2="100" y2="0" /><line x1="0" y1="50" x2="100" y2="50" /><line x1="0" y1="100" x2="100" y2="100" /></g><path className="growth-area" d={area} /><path className="growth-line" d={curve} markerEnd="url(#portfolio-growth-arrow)" /></svg><div className="chart-x-axis">{xAxis.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div></div></section>
}

function HoldingsTable({ positions, onDelete, compact = false }: { positions: (Holding & { price: number; change: number | null; value: number; quote?: LiveQuote })[]; onDelete: (holding: Holding) => void; compact?: boolean }) { if (!positions.length) return <div className="empty-state"><WalletCards size={24} /><h2>No open positions</h2><p>Record a buy transaction to create your first position.</p></div>; return <div className="table-scroll"><table><thead><tr><th>ASSET</th><th>QUANTITY</th><th>AVG. BUY PRICE</th><th>MARKET PRICE</th><th>CHANGE</th><th>TOTAL VALUE</th><th /></tr></thead><tbody>{positions.map((item) => <tr key={item.id}><td><div className="asset-cell"><AssetIcon assetType={item.assetType} symbol={item.symbol} /><div><strong>{item.name}</strong><span>{item.symbol} · {typeName(item.assetType)}</span></div></div></td><td>{quantities.format(item.quantity)}</td><td>{currency.format(item.averageBuyPrice)}</td><td><strong className="quote-price">{currency.format(item.price)}</strong><small className="quote-source">{quoteLabel(item.quote)}</small></td><td>{item.change === null ? <span className="muted">—</span> : <span className={`change-pill ${item.change >= 0 ? 'positive' : 'negative'}`}>{item.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{item.change.toFixed(2)}%</span>}</td><td className="value-cell">{currency.format(item.value)}</td><td><button className="row-menu delete-button" onClick={() => onDelete(item)} aria-label={`Remove ${item.symbol} holding`}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> }

function TransactionsTable({ transactions, onExport, onDelete, onSelect, error, compact = false, heading, description, showControls = true }: { transactions: PortfolioTransaction[]; onExport: () => void; onDelete: (transactionId: number) => void; onSelect?: (transaction: PortfolioTransaction) => void; error: string; compact?: boolean; heading?: string; description?: string; showControls?: boolean }) {
  const [assetType, setAssetType] = useState<'all' | Holding['assetType']>('all')
  const [age, setAge] = useState<'all' | '30' | '90' | 'year'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'asset-asc' | 'asset-desc'>('newest')
  const rows = useMemo(() => {
    if (compact) return transactions.slice(0, 5)
    const minimumDate = age === '30' ? Date.now() - 30 * 86_400_000 : age === '90' ? Date.now() - 90 * 86_400_000 : age === 'year' ? new Date(new Date().getFullYear(), 0, 1).getTime() : 0
    const filtered = transactions.filter((item) => (assetType === 'all' || item.assetType === assetType) && new Date(`${item.transactionDate}T00:00:00`).getTime() >= minimumDate)
    return filtered.sort((left, right) => {
      if (sort === 'asset-asc') return left.assetType.localeCompare(right.assetType) || right.transactionDate.localeCompare(left.transactionDate)
      if (sort === 'asset-desc') return right.assetType.localeCompare(left.assetType) || right.transactionDate.localeCompare(left.transactionDate)
      return sort === 'newest' ? right.transactionDate.localeCompare(left.transactionDate) || right.id - left.id : left.transactionDate.localeCompare(right.transactionDate) || left.id - right.id
    })
  }, [transactions, compact, assetType, age, sort])
  return <section className="card holdings-card functional-holdings transaction-ledger">
    <div className="card-header holdings-heading"><div><h2>{heading ?? (compact ? 'Recent transactions' : 'Transaction ledger')}</h2><p>{description ?? (compact ? 'Your latest recorded buys and sells.' : 'Every buy and sell is kept as a separate record for tax preparation.')}</p></div><button className="view-all" onClick={onExport} disabled={!transactions.length}><Download size={15} /> Export CSV</button></div>
    {!compact && showControls && <div className="transaction-controls"><label>Asset type<select value={assetType} onChange={(event) => setAssetType(event.target.value as 'all' | Holding['assetType'])}><option value="all">All assets</option><option value="stock">Stocks</option><option value="etf">ETFs</option><option value="crypto">Crypto</option></select></label><label>Transaction age<select value={age} onChange={(event) => setAge(event.target.value as 'all' | '30' | '90' | 'year')}><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This year</option></select></label><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as 'newest' | 'oldest' | 'asset-asc' | 'asset-desc')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="asset-asc">Asset type: A–Z</option><option value="asset-desc">Asset type: Z–A</option></select></label><span className="transaction-result-count">{rows.length} result{rows.length === 1 ? '' : 's'}</span></div>}
    {error && <p className="form-error ledger-error">{error}</p>}
    {rows.length ? <div className="table-scroll"><table className="transaction-table"><thead><tr><th>DATE</th><th>TYPE</th><th>ASSET</th><th>QUANTITY</th><th>UNIT PRICE</th><th>GROSS AMOUNT</th><th>NOTES</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className={onSelect ? 'transaction-row-selectable' : undefined} onClick={() => onSelect?.(item)}><td>{item.transactionDate}</td><td><span className={`transaction-type ${item.type}`}>{item.type.toUpperCase()}</span></td><td><div className="asset-cell"><div><strong>{item.name}</strong><span>{item.symbol} · {typeName(item.assetType)}</span></div></div></td><td>{quantities.format(item.quantity)}</td><td>{currency.format(item.unitPrice)}</td><td className="value-cell">{currency.format(item.quantity * item.unitPrice)}</td><td className="muted notes-cell">{item.notes || '—'}</td><td><button className="row-menu delete-button" onClick={(event) => { event.stopPropagation(); void onDelete(item.id) }} aria-label={`Remove ${item.type} transaction for ${item.symbol}`}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><ReceiptText size={24} /><h2>No transactions yet</h2><p>Add each buy or sell with its execution date, quantity, and unit price. You can later export the ledger as CSV.</p></div>}
  </section>
}

type TaxLot = Pick<PortfolioTransaction, 'id' | 'symbol' | 'name' | 'assetType' | 'quantity' | 'unitPrice' | 'transactionDate'> & { remaining: number }
type TaxSale = { sale: PortfolioTransaction; buy: TaxLot | null; quantity: number; cost: number; proceeds: number; profit: number | null; holdingDays: number | null; rate: number | null; taxableGain: number | null; tax: number | null }

function completedYears(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`), end = new Date(`${endDate}T00:00:00`)
  let years = end.getFullYear() - start.getFullYear()
  if (end.getMonth() < start.getMonth() || end.getMonth() === start.getMonth() && end.getDate() < start.getDate()) years--
  return Math.max(0, years)
}

function calculateTaxSales(transactions: PortfolioTransaction[]): TaxSale[] {
  const lots = new Map<string, TaxLot[]>()
  const rows: TaxSale[] = []
  const ordered = [...transactions].sort((left, right) => left.transactionDate.localeCompare(right.transactionDate) || left.id - right.id)
  for (const transaction of ordered) {
    const key = `${transaction.assetType}:${transaction.symbol}`
    if (transaction.type === 'buy') {
      lots.set(key, [...(lots.get(key) ?? []), { ...transaction, remaining: transaction.quantity }])
      continue
    }
    let remaining = transaction.quantity
    const availableLots = lots.get(key) ?? []
    for (const lot of availableLots) {
      if (remaining <= 1e-10) break
      const quantity = Math.min(remaining, lot.remaining)
      if (quantity <= 1e-10) continue
      const cost = quantity * lot.unitPrice, proceeds = quantity * transaction.unitPrice, profit = proceeds - cost
      const rate = transaction.assetType === 'crypto' ? null : completedYears(lot.transactionDate, transaction.transactionDate) >= 15 ? 0 : completedYears(lot.transactionDate, transaction.transactionDate) >= 10 ? .15 : completedYears(lot.transactionDate, transaction.transactionDate) >= 5 ? .20 : .25
      const normalExpenses = profit > 0 ? Math.min(profit, cost * .01 + proceeds * .01) : 0
      const taxableGain = rate === null ? null : Math.max(0, profit - normalExpenses)
      rows.push({ sale: transaction, buy: lot, quantity, cost, proceeds, profit, holdingDays: Math.max(0, Math.round((new Date(`${transaction.transactionDate}T00:00:00`).getTime() - new Date(`${lot.transactionDate}T00:00:00`).getTime()) / 86_400_000)), rate, taxableGain, tax: taxableGain === null || rate === null ? null : taxableGain * rate })
      lot.remaining -= quantity
      remaining -= quantity
    }
    if (remaining > 1e-10) rows.push({ sale: transaction, buy: null, quantity: remaining, cost: 0, proceeds: remaining * transaction.unitPrice, profit: null, holdingDays: null, rate: null, taxableGain: null, tax: null })
    lots.set(key, availableLots.filter((lot) => lot.remaining > 1e-10))
  }
  return rows
}

function holdingPeriod(days: number | null) {
  if (days === null) return 'Purchase missing'
  const years = Math.floor(days / 365), months = Math.floor(days % 365 / 30)
  return years ? `${years}y ${months}m` : months ? `${months}m ${days % 30}d` : `${days}d`
}

function TaxEstimateModal({ transactions, transaction, quotes, onClose, onSell }: { transactions: PortfolioTransaction[]; transaction: PortfolioTransaction; quotes: Record<string, LiveQuote>; onClose: () => void; onSell: (source: PortfolioTransaction, form: FormData) => Promise<string | null> }) {
  const [sellError, setSellError] = useState('')
  const [selling, setSelling] = useState(false)
  const sales = useMemo(() => calculateTaxSales(transactions), [transactions])
  const rows = sales.filter((item) => item.sale.id === transaction.id)
  const realisedProfit = rows.reduce((sum, item) => sum + (item.profit ?? 0), 0)
  const taxableGain = rows.reduce((sum, item) => sum + (item.taxableGain ?? 0), 0)
  const estimatedTax = rows.reduce((sum, item) => sum + (item.tax ?? 0), 0)

  const buySelected = transaction.type === 'buy'
  const quantityAlreadySold = sales.filter((item) => item.buy?.id === transaction.id).reduce((sum, item) => sum + item.quantity, 0)
  const availableToSell = Math.max(0, transaction.quantity - quantityAlreadySold)
  const quote = quotes[marketSymbol(transaction)]
  const conversion = quote?.currency === 'EUR' ? 1 : quotes['USD/EUR']?.price ?? 1
  const liveUnitPrice = quote ? quote.price * conversion : null
  const [saleQuantity, setSaleQuantity] = useState(() => String(availableToSell))
  const [salePrice, setSalePrice] = useState(() => String(liveUnitPrice ?? transaction.unitPrice))
  const [saleDate, setSaleDate] = useState(today)
  const purchaseAmount = transaction.quantity * transaction.unitPrice
  const liveValue = liveUnitPrice === null ? null : transaction.quantity * liveUnitPrice
  const unrealisedProfit = liveValue === null ? null : liveValue - purchaseAmount
  const potentialRate = transaction.assetType === 'crypto' ? null : completedYears(transaction.transactionDate, today()) >= 15 ? 0 : completedYears(transaction.transactionDate, today()) >= 10 ? .15 : completedYears(transaction.transactionDate, today()) >= 5 ? .20 : .25
  const potentialExpenses = unrealisedProfit !== null && unrealisedProfit > 0 && liveValue !== null ? Math.min(unrealisedProfit, purchaseAmount * .01 + liveValue * .01) : 0
  const potentialTaxableGain = unrealisedProfit === null || potentialRate === null ? null : Math.max(0, unrealisedProfit - potentialExpenses)
  const potentialTax = potentialTaxableGain === null || potentialRate === null ? null : potentialTaxableGain * potentialRate
  const displayProfit = buySelected ? unrealisedProfit : realisedProfit
  const displayTaxableGain = buySelected ? potentialTaxableGain : taxableGain
  const displayTax = buySelected ? potentialTax : estimatedTax
  const referenceBuy = buySelected ? transaction : rows.length === 1 ? rows[0].buy : null
  const comparisonDate = buySelected ? today() : transaction.transactionDate
  const referenceAge = referenceBuy ? Math.max(0, Math.round((new Date(`${comparisonDate}T00:00:00`).getTime() - new Date(`${referenceBuy.transactionDate}T00:00:00`).getTime()) / 86_400_000)) : null
  const growthEnd = buySelected ? liveValue : rows.length ? rows.reduce((sum, item) => sum + item.proceeds, 0) : null
  const saleQuantityNumber = Number(saleQuantity)
  const salePriceNumber = Number(salePrice)
  const salePreviewIsValid = Number.isFinite(saleQuantityNumber) && saleQuantityNumber > 0 && saleQuantityNumber <= availableToSell && Number.isFinite(salePriceNumber) && salePriceNumber >= 0
  const saleProceeds = salePreviewIsValid ? saleQuantityNumber * salePriceNumber : null
  const saleCost = salePreviewIsValid ? saleQuantityNumber * transaction.unitPrice : null
  const saleProfit = saleProceeds === null || saleCost === null ? null : saleProceeds - saleCost
  const saleRate = transaction.assetType === 'crypto' ? null : completedYears(transaction.transactionDate, saleDate) >= 15 ? 0 : completedYears(transaction.transactionDate, saleDate) >= 10 ? .15 : completedYears(transaction.transactionDate, saleDate) >= 5 ? .20 : .25
  const saleExpenses = saleProfit !== null && saleProfit > 0 && saleProceeds !== null && saleCost !== null ? Math.min(saleProfit, saleCost * .01 + saleProceeds * .01) : 0
  const saleTax = saleProfit === null || saleRate === null ? null : Math.max(0, saleProfit - saleExpenses) * saleRate
  const cashAfterTax = saleProceeds === null || saleTax === null ? null : saleProceeds - saleTax
  const profitAfterTax = saleProfit === null || saleTax === null ? null : saleProfit - saleTax
  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSellError('')
    setSelling(true)
    const error = await onSell(transaction, new FormData(event.currentTarget))
    setSelling(false)
    if (error) { setSellError(error); return }
    onClose()
  }
  return <div className="tax-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="tax-modal" role="dialog" aria-modal="true" aria-labelledby="tax-estimate-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="tax-modal-header"><div><p className="eyebrow">SLOVENIA · FIFO ESTIMATE</p><h2 id="tax-estimate-title">{transaction.symbol} · {transaction.type === 'buy' ? 'Buy' : 'Sale'} calculation</h2><p>{buySelected ? 'A purchase does not create taxable capital gain until it is sold.' : 'This sale is matched with its earliest remaining purchase(s).'}</p></div><button className="row-menu" onClick={onClose} aria-label="Close tax estimate"><X size={19} /></button></div>
      <div className="tax-summary"><div><span>{buySelected ? 'Unrealised gain / loss' : 'Realised profit / loss'}</span><strong className={displayProfit === null ? 'muted' : displayProfit >= 0 ? 'positive' : 'negative'}>{displayProfit === null ? '—' : currency.format(displayProfit)}</strong></div><div><span>{buySelected ? 'Potential taxable gain' : 'Estimated taxable gain'}</span><strong>{displayTaxableGain === null ? '—' : currency.format(displayTaxableGain)}</strong></div><div><span>{buySelected ? 'Potential tax if sold today' : 'Estimated tax'}</span><strong className="tax-total">{displayTax === null ? '—' : currency.format(displayTax)}</strong></div></div>
      <div className="tax-holding-details"><div><span>Buy date</span><strong>{referenceBuy?.transactionDate ?? 'Multiple purchases'}</strong></div><div><span>Holding age</span><strong>{referenceAge === null ? 'See matched lots' : holdingPeriod(referenceAge)}</strong></div><div><span>{buySelected ? 'Current value' : 'Sale value'}</span><strong>{growthEnd === null ? '—' : currency.format(growthEnd)}</strong></div></div>
      {!buySelected && (rows.length ? <div className="table-scroll tax-table-wrap"><table className="tax-table"><thead><tr><th>SOLD / MATCHED BUY</th><th>HELD</th><th>COST</th><th>PROCEEDS</th><th>PROFIT</th><th>RATE</th><th>EST. TAX</th></tr></thead><tbody>{rows.map((item, index) => <tr key={`${item.sale.id}-${item.buy?.id ?? 'missing'}-${index}`}><td><strong>{item.sale.symbol}</strong><small>Sold {item.sale.transactionDate}{item.buy ? ` · Bought ${item.buy.transactionDate}` : ' · Buy not found'}</small></td><td>{holdingPeriod(item.holdingDays)}</td><td>{item.buy ? currency.format(item.cost) : '—'}</td><td>{currency.format(item.proceeds)}</td><td className={item.profit === null ? 'muted' : item.profit >= 0 ? 'positive' : 'negative'}>{item.profit === null ? '—' : currency.format(item.profit)}</td><td>{item.sale.assetType === 'crypto' ? 'Crypto*' : item.rate === null ? '—' : `${(item.rate * 100).toFixed(0)}%`}</td><td className="value-cell">{item.tax === null ? '—' : currency.format(item.tax)}</td></tr>)}</tbody></table></div> : <div className="empty-state tax-empty"><ReceiptText size={24} /><h2>Purchase record missing</h2><p>This sale cannot be matched to an earlier buy transaction, so no tax estimate is available.</p></div>)}
      {buySelected && <form className="quick-sell-form" onSubmit={submitSale}>
        <div><h3>Sell from this purchase</h3><p>Creates a separate sell transaction and reduces this holding using FIFO.</p></div>
        {availableToSell > 1e-10 ? <div className="quick-sell-fields">
          <label>Quantity<input name="quantity" type="number" min="0.00000001" max={availableToSell} step="any" value={saleQuantity} onChange={(event) => setSaleQuantity(event.target.value)} required /></label>
          <label>Sell price (EUR)<input name="unitPrice" type="number" min="0" step="any" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required /></label>
          <label>Sale date<input name="transactionDate" type="date" min={transaction.transactionDate} value={saleDate} onChange={(event) => setSaleDate(event.target.value)} required /></label>
          <label>Notes (optional)<input name="notes" maxLength={500} placeholder="Broker or fee reference" /></label>
          <button className="primary-action sell-action" type="submit" disabled={selling}>{selling ? 'Recording sale…' : `Sell ${transaction.symbol}`}</button>
        </div> : <p className="form-help">All units from this purchase have already been sold.</p>}
        {availableToSell > 1e-10 && <div className="sale-preview" aria-live="polite"><div><span>Gross sale proceeds</span><strong>{saleProceeds === null ? '—' : currency.format(saleProceeds)}</strong></div><div><span>Estimated tax</span><strong className="negative">{saleTax === null ? 'Not estimated*' : currency.format(saleTax)}</strong></div><div><span>Cash after estimated tax</span><strong className="tax-total">{cashAfterTax === null ? '—' : currency.format(cashAfterTax)}</strong></div><div><span>Net profit after tax</span><strong className={profitAfterTax === null ? 'muted' : profitAfterTax >= 0 ? 'positive' : 'negative'}>{profitAfterTax === null ? '—' : currency.format(profitAfterTax)}</strong></div><p>{transaction.assetType === 'crypto' ? '* Crypto tax is not estimated.' : 'Based on this price and date, including the standard expense allowance.'}</p></div>}
        {sellError && <p className="form-error" aria-live="polite">{sellError}</p>}
      </form>}
      <div className="tax-disclaimer"><p><strong>Estimate only.</strong> For shares and ETFs, it uses the Slovenian 25% / 20% / 15% / 0% brackets after 0 / 5 / 10 / 15 completed years and the standard 1% acquisition plus 1% disposal expense allowance on positive gains.</p><p>* Personal crypto tax treatment is not calculated. This does not apply annual loss offsets, broker fees, FX conversion, INR rules, or any special circumstances. Confirm your filing with FURS or a tax adviser.</p><a href="https://www.fu.gov.si/zivljenjski_dogodki_prebivalci/odsvojil_sem_vrednostne_papirje_druge_deleze_ali_investicijske_kupone" target="_blank" rel="noreferrer">Open official FURS guidance</a></div>
    </section>
  </div>
}

function Metric({ label, value, tone, detail }: { label: string; value: string; tone?: 'positive' | 'negative'; detail?: string }) { return <div className="metric-card"><div className="metric-label">{label.toUpperCase()}</div><div className={`small-metric-value ${tone ?? ''}`}>{value}</div>{detail && <div className={`small-change ${tone ?? 'muted'}`}>{detail}</div>}</div> }
