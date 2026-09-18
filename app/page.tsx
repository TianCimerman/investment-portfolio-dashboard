import { redirect } from 'next/navigation'
import { PortfolioDashboard } from '@/components/portfolio-dashboard'
import { getSessionUser } from '@/lib/auth'
import { listHoldings } from '@/lib/holdings'
import { listTransactions } from '@/lib/transactions'
import { listWatchlist } from '@/lib/watchlist'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return <PortfolioDashboard user={user} initialHoldings={listHoldings(user.id)} initialTransactions={listTransactions(user.id)} initialWatchlist={listWatchlist(user.id)} />
}

/* Legacy static mockup retained in source history while this app migrates to the authenticated dashboard.

import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  Star,
  Target,
  WalletCards,
  X,
} from 'lucide-react'

const holdings = [
  { name: 'Bitcoin', ticker: 'BTC', type: 'Crypto', mark: '₿', tone: 'orange', quantity: '0.84', avg: '$42,180.00', current: '$67,842.16', change: '+4.82%', value: '$56,987.41', spark: '0,22 14,19 28,22 42,13 56,16 70,9 84,11 98,2' },
  { name: 'Ethereum', ticker: 'ETH', type: 'Crypto', mark: '◆', tone: 'violet', quantity: '4.20', avg: '$2,940.00', current: '$3,842.55', change: '+2.16%', value: '$16,139.34', spark: '0,20 14,18 28,20 42,15 56,17 70,7 84,12 98,5' },
  { name: 'Apple Inc.', ticker: 'AAPL', type: 'Stock', mark: 'A', tone: 'blue', quantity: '42', avg: '$168.40', current: '$213.25', change: '+1.08%', value: '$8,956.50', spark: '0,17 14,22 28,15 42,17 56,10 70,12 84,5 98,8' },
  { name: 'NVIDIA Corp.', ticker: 'NVDA', type: 'Stock', mark: 'N', tone: 'green', quantity: '18', avg: '$482.70', current: '$875.40', change: '-0.74%', value: '$15,757.20', spark: '0,8 14,11 28,9 42,18 56,14 70,16 84,12 98,21' },
  { name: 'Vanguard S&P 500', ticker: 'VOO', type: 'ETF', mark: 'V', tone: 'teal', quantity: '26', avg: '$398.21', current: '$503.62', change: '+0.63%', value: '$13,094.12', spark: '0,21 14,18 28,19 42,13 56,14 70,11 84,7 98,8' },
  { name: 'Invesco QQQ', ticker: 'QQQ', type: 'ETF', mark: 'Q', tone: 'pink', quantity: '14', avg: '$365.80', current: '$456.72', change: '+0.44%', value: '$6,394.08', spark: '0,20 14,17 28,20 42,14 56,16 70,12 84,13 98,7' },
]

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Holdings', icon: WalletCards },
  { label: 'Watchlist', icon: Star },
  { label: 'Transactions', icon: CircleDollarSign },
]

function AssetMark({ mark, tone }: { mark: string; tone: string }) {
  return <span className={`asset-mark ${tone}`}>{mark}</span>
}

function Sparkline({ points, positive }: { points: string; positive: boolean }) {
  return (
    <svg className="sparkline" viewBox="0 0 98 24" preserveAspectRatio="none" aria-label="Performance trend">
      <polyline points={points} fill="none" stroke={positive ? 'var(--teal)' : 'var(--red)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PerformanceChart() {
  return (
    <div className="performance-chart" aria-label="Portfolio value performance chart">
      <div className="chart-y-axis"><span>$105k</span><span>$100k</span><span>$95k</span><span>$90k</span></div>
      <svg viewBox="0 0 880 310" preserveAspectRatio="none" className="chart-svg" role="img">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--teal)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid"><line x1="0" y1="20" x2="880" y2="20" /><line x1="0" y1="95" x2="880" y2="95" /><line x1="0" y1="170" x2="880" y2="170" /><line x1="0" y1="245" x2="880" y2="245" /></g>
        <path d="M0 246 C35 239 45 219 73 224 S110 243 140 212 S177 188 205 197 S239 168 266 181 S302 149 330 154 S364 123 394 137 S424 111 454 119 S494 104 516 112 S554 72 585 84 S614 66 643 78 S676 56 700 63 S735 35 758 47 S795 29 820 39 S850 20 880 24 L880 310 L0 310 Z" fill="url(#chartFill)" />
        <path d="M0 246 C35 239 45 219 73 224 S110 243 140 212 S177 188 205 197 S239 168 266 181 S302 149 330 154 S364 123 394 137 S424 111 454 119 S494 104 516 112 S554 72 585 84 S614 66 643 78 S676 56 700 63 S735 35 758 47 S795 29 820 39 S850 20 880 24" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="880" cy="24" r="5" fill="var(--teal)" stroke="var(--background)" strokeWidth="3" />
      </svg>
      <div className="chart-x-axis"><span>May 12</span><span>May 19</span><span>May 26</span><span>Jun 02</span><span>Jun 09</span><span>Jun 16</span></div>
    </div>
  )
}

function SubpagePanel({ page }: { page: string }) {
  const pageCopy = {
    Holdings: { eyebrow: 'PORTFOLIO INVENTORY', title: 'Your holdings', description: 'A complete view of every position across your accounts.' },
    Watchlist: { eyebrow: 'MARKET RADAR', title: 'Watchlist', description: 'Keep an eye on assets before they enter your portfolio.' },
    Transactions: { eyebrow: 'ACTIVITY', title: 'Transactions', description: 'Review your recent buys, sells, dividends, and deposits.' },
  }[page as 'Holdings' | 'Watchlist' | 'Transactions']

  if (!pageCopy) return null

  const rows = page === 'Watchlist'
    ? [{ name: 'Solana', ticker: 'SOL', mark: 'S', tone: 'violet', price: '$142.84', change: '+6.42%', note: 'Strong momentum' }, { name: 'Microsoft', ticker: 'MSFT', mark: 'M', tone: 'blue', price: '$442.57', change: '+1.26%', note: 'Near price target' }, { name: 'iShares Core MSCI EAFE', ticker: 'IEFA', mark: 'I', tone: 'teal', price: '$78.31', change: '-0.18%', note: 'Tracking range' }]
    : page === 'Transactions'
      ? [{ name: 'Bought Bitcoin', ticker: 'BTC', mark: '₿', tone: 'orange', price: '+$2,500.00', change: 'Jun 18, 2024', note: '0.0368 BTC · Market order' }, { name: 'Dividend received', ticker: 'VOO', mark: 'V', tone: 'teal', price: '+$84.12', change: 'Jun 14, 2024', note: 'Vanguard S&P 500' }, { name: 'Sold NVIDIA Corp.', ticker: 'NVDA', mark: 'N', tone: 'green', price: '-$1,420.00', change: 'Jun 11, 2024', note: '1.62 shares · Limit order' }]
      : holdings.map((holding) => ({ name: holding.name, ticker: holding.ticker, mark: holding.mark, tone: holding.tone, price: holding.value, change: holding.change, note: `${holding.quantity} units · ${holding.type}` }))

  return <section className="subpage-panel">
    <div className="subpage-intro"><div><p className="eyebrow">{pageCopy.eyebrow}</p><h2>{pageCopy.title}</h2><p>{pageCopy.description}</p></div><button className="primary-action">{page === 'Transactions' ? 'Export activity' : page === 'Watchlist' ? 'Add asset' : 'Add holding'} <ArrowUpRight size={15} /></button></div>
    <div className="subpage-summary"><div><span>Total positions</span><strong>{page === 'Transactions' ? '24' : page === 'Watchlist' ? '8' : '6'}</strong></div><div><span>Market value</span><strong>{page === 'Transactions' ? '$18,426.50' : '$117,328.65'}</strong></div><div><span>Today&apos;s change</span><strong className={page === 'Transactions' ? 'positive' : 'positive'}>+2.10%</strong></div></div>
    <div className="card subpage-table-card"><div className="card-header"><div><h2>{page === 'Transactions' ? 'Recent activity' : page === 'Watchlist' ? 'Tracked assets' : 'All positions'}</h2><p>{rows.length} items updated moments ago</p></div><button className="filter-button">Filter <ChevronDown size={14} /></button></div><div className="table-scroll"><table className="subpage-table"><thead><tr><th>ASSET</th><th>{page === 'Transactions' ? 'AMOUNT' : 'PRICE'}</th><th>{page === 'Transactions' ? 'DATE' : '24H CHANGE'}</th><th>DETAILS</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.ticker + row.name}><td><div className="asset-cell"><AssetMark mark={row.mark} tone={row.tone} /><div><strong>{row.name}</strong><span>{row.ticker}</span></div></div></td><td className="value-cell">{row.price}</td><td><span className={row.change.startsWith('-') ? 'negative' : 'positive'}>{row.change}</span></td><td className="muted">{row.note}</td><td><button className="row-menu" aria-label={`More options for ${row.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div></div>
  </section>
}

export default function Page() {
  const [range, setRange] = useState('1M')
  const [mobileNav, setMobileNav] = useState(false)
  const [activePage, setActivePage] = useState('Overview')

  return (
    <main className="dashboard-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><span /></span><span>northstar</span><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }, index) => <button className={`nav-item ${activePage === label ? 'active' : ''}`} key={label} onClick={() => { setActivePage(label); setMobileNav(false) }}><Icon size={18} strokeWidth={activePage === label ? 2.4 : 1.8} /><span>{label}</span>{label === 'Watchlist' && <span className="nav-count">6</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item"><Settings size={18} /><span>Settings</span></button><div className="user-card"><div className="avatar">JD</div><div><strong>Jordan Davis</strong><span>Personal account</span></div><MoreHorizontal size={17} className="more" /></div></div>
      </aside>

      <section className={`dashboard-content ${activePage !== 'Overview' ? 'subpage-active' : ''}`}>
        <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span className="muted">Workspace</span><span>/</span><strong>{activePage}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Search"><Search size={18} /></button><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">JD</div></div></header>

        <div className="page-wrap">
          <div className="page-heading"><div><p className="eyebrow">TUESDAY, JUNE 18, 2024</p><h1>{activePage === 'Overview' ? 'Good morning, Jordan' : activePage}</h1></div><button className="date-button">Last updated just now <ChevronDown size={15} /></button></div>

          <SubpagePanel page={activePage} />
          <section className="metric-grid">
            <div className="metric-card hero-metric"><div className="metric-label">TOTAL PORTFOLIO VALUE <span className="info-dot">i</span></div><div className="metric-value">$117,328<span className="decimal">.65</span></div><div className="metric-change positive"><ArrowUpRight size={16} />$2,418.32 <span>(+2.10%)</span></div></div>
            <div className="metric-card"><div className="metric-label">TODAY&apos;S RETURN</div><div className="small-metric-value positive">+$1,284.50</div><div className="small-change positive">+1.11%</div></div>
            <div className="metric-card"><div className="metric-label">TOTAL RETURN</div><div className="small-metric-value positive">+$28,506.42</div><div className="small-change positive">+32.07%</div></div>
            <div className="metric-card"><div className="metric-label">CASH BALANCE</div><div className="small-metric-value">$4,265.90</div><div className="small-change muted">Available to invest</div></div>
          </section>

          <div className="section-grid top-grid">
            <section className="card performance-card"><div className="card-header"><div><h2>Portfolio performance</h2><p>Value over time</p></div><div className="range-tabs" role="tablist">{['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((item) => <button key={item} className={range === item ? 'selected' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><div className="chart-stat"><span>$117,328.65</span><small className="positive">+2.10% <em>vs. previous period</em></small></div><PerformanceChart /></section>
            <section className="card allocation-card"><div className="card-header"><div><h2>Asset allocation</h2><p>By asset class</p></div><button className="kebab" aria-label="Allocation options"><MoreHorizontal size={18} /></button></div><div className="allocation-body"><div className="donut-wrap"><div className="donut"><div className="donut-hole"><strong>100%</strong><span>invested</span></div></div></div><div className="allocation-legend"><div><span className="legend-dot crypto" /><div><strong>Crypto</strong><small>$73,126.75</small></div><b>62.3%</b></div><div><span className="legend-dot stocks" /><div><strong>Stocks</strong><small>$24,713.70</small></div><b>21.1%</b></div><div><span className="legend-dot etfs" /><div><strong>ETFs</strong><small>$19,488.20</small></div><b>16.6%</b></div></div></div></section>
          </div>

          <div className="section-grid lower-grid"><section className="card holdings-card"><div className="card-header holdings-heading"><div><h2>Holdings</h2><p>6 assets in your portfolio</p></div><button className="view-all">View all <ArrowUpRight size={15} /></button></div><div className="table-scroll"><table><thead><tr><th>ASSET</th><th>QUANTITY</th><th>AVG. BUY PRICE</th><th>CURRENT PRICE</th><th>24H CHANGE</th><th>TOTAL VALUE</th><th>7D TREND</th></tr></thead><tbody>{holdings.map((holding) => { const positive = !holding.change.startsWith('-'); return <tr key={holding.ticker}><td><div className="asset-cell"><AssetMark mark={holding.mark} tone={holding.tone} /><div><strong>{holding.name}</strong><span>{holding.ticker} · {holding.type}</span></div></div></td><td className="number-cell">{holding.quantity}</td><td className="number-cell">{holding.avg}</td><td className="number-cell">{holding.current}</td><td><span className={`change-pill ${positive ? 'positive' : 'negative'}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{holding.change}</span></td><td className="value-cell">{holding.value}</td><td><Sparkline points={holding.spark} positive={positive} /></td></tr>})}</tbody></table></div></section><section className="card movers-card"><div className="card-header"><div><h2>Top movers</h2><p>Today&apos;s biggest moves</p></div><button className="kebab" aria-label="Top movers options"><MoreHorizontal size={18} /></button></div><div className="mover-block"><div className="mover-label"><span className="mover-dot up" />TOP GAINER</div><div className="mover-row"><AssetMark mark="₿" tone="orange" /><div><strong>Bitcoin</strong><span>BTC</span></div><div className="mover-value"><b>+4.82%</b><small>+$3,118.84</small></div></div></div><div className="mover-block loser"><div className="mover-label"><span className="mover-dot down" />TOP LOSER</div><div className="mover-row"><AssetMark mark="N" tone="green" /><div><strong>NVIDIA Corp.</strong><span>NVDA</span></div><div className="mover-value"><b>-0.74%</b><small>-$117.45</small></div></div></div><button className="watch-button"><Target size={16} /> View watchlist <ArrowUpRight size={15} /></button></section></div>
        </div>
      </section>
    </main>
  )
}
*/
