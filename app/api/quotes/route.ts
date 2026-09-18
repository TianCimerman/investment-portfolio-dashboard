import { getSessionUser } from '@/lib/auth'
import type { AssetType, LiveQuote } from '@/lib/portfolio'

export const runtime = 'nodejs'

type AssetRequest = { assetType: AssetType | 'forex'; symbol: string }
type CachedQuote = { quote: LiveQuote; expiresAt: number }
type TwelveQuote = { close?: string | number; price?: string | number; previous_close?: string | number; currency?: string }
type EodhdQuote = { code?: string; close?: string | number; previousClose?: string | number; previous_close?: string | number }
type CoinGeckoPrice = Record<string, Record<string, number | undefined>>

const cache = new Map<string, CachedQuote>()
const symbolPattern = /^[A-Z0-9./:-]{1,32}$/
const cryptoIds: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink', LTC: 'litecoin', BNB: 'binancecoin', USDT: 'tether', USDC: 'usd-coin', MATIC: 'matic-network', TRX: 'tron',
}
const eodhdEuropeanExchanges = new Set(['XETRA', 'LSE', 'AS', 'PA', 'BR', 'LS', 'MI', 'MC', 'ST', 'CO', 'HE', 'OL', 'VI', 'WAR'])

function numberOrNull(value: string | number | undefined) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function parseAssets(request: Request): AssetRequest[] {
  const params = new URL(request.url).searchParams
  const encoded = params.get('assets')
  if (encoded) {
    return [...new Set(encoded.split(',').map((item) => item.trim().toUpperCase()))].flatMap((item) => {
      const separator = item.indexOf(':')
      const assetType = item.slice(0, separator).toLowerCase()
      const symbol = item.slice(separator + 1)
      return (separator > 0 && ['stock', 'etf', 'crypto', 'forex'].includes(assetType) && symbolPattern.test(symbol)) ? [{ assetType: assetType as AssetRequest['assetType'], symbol }] : []
    }).slice(0, 30)
  }

  return [...new Set((params.get('symbols') ?? '').split(',').map((item) => item.trim().toUpperCase()).filter((item) => symbolPattern.test(item)))].slice(0, 30).map((symbol) => ({ assetType: symbol.includes('/') ? 'forex' : 'stock', symbol }))
}

function cacheKey(asset: AssetRequest) { return `${asset.assetType}:${asset.symbol}` }
function getCached(asset: AssetRequest, now: number) {
  const value = cache.get(cacheKey(asset))
  return value && value.expiresAt > now ? value.quote : null
}
function saveCached(asset: AssetRequest, quote: LiveQuote, now: number, duration: number) {
  cache.set(cacheKey(asset), { quote, expiresAt: now + duration })
}

function readTwelveQuote(value: TwelveQuote | undefined): LiveQuote | null {
  const price = numberOrNull(value?.close ?? value?.price)
  if (!price) return null
  return { price, previousClose: numberOrNull(value?.previous_close), currency: value?.currency?.toUpperCase() || 'USD', source: 'twelve-data', freshness: 'live' }
}

async function fetchTwelve(assets: AssetRequest[], now: number) {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  const quotes: Record<string, LiveQuote> = {}
  if (!apiKey || !assets.length) return quotes
  const url = new URL('https://api.twelvedata.com/quote')
  url.searchParams.set('symbol', assets.map((asset) => asset.symbol).join(','))
  const response = await fetch(url, { headers: { Authorization: `apikey ${apiKey}` }, cache: 'no-store' })
  const data = await response.json() as Record<string, TwelveQuote> & TwelveQuote & { code?: number; message?: string }
  if (!response.ok || data.code) throw new Error(data.message ?? 'Twelve Data request failed.')
  for (const asset of assets) {
    const quote = readTwelveQuote(assets.length === 1 ? data : data[asset.symbol])
    if (quote) { quotes[asset.symbol] = quote; saveCached(asset, quote, now, 5 * 60_000) }
  }
  return quotes
}

async function fetchCoinGecko(assets: AssetRequest[], now: number) {
  const apiKey = process.env.COINGECKO_DEMO_API_KEY
  const quotes: Record<string, LiveQuote> = {}
  if (!apiKey || !assets.length) return quotes
  const resolved = assets.flatMap((asset) => {
    const id = cryptoIds[asset.symbol.split('/')[0]]
    return id ? [{ asset, id }] : []
  })
  if (!resolved.length) return quotes
  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', [...new Set(resolved.map((item) => item.id))].join(','))
  url.searchParams.set('vs_currencies', 'eur')
  url.searchParams.set('include_24hr_change', 'true')
  const response = await fetch(url, { headers: { 'x-cg-demo-api-key': apiKey }, cache: 'no-store' })
  const data = await response.json() as CoinGeckoPrice & { status?: { error_message?: string } }
  if (!response.ok) throw new Error(data.status?.error_message ?? 'CoinGecko request failed.')
  for (const { asset, id } of resolved) {
    const price = numberOrNull(data[id]?.eur)
    if (!price) continue
    const change = Number(data[id]?.eur_24h_change)
    const previousClose = Number.isFinite(change) && change > -100 ? price / (1 + change / 100) : null
    const quote: LiveQuote = { price, previousClose, currency: 'EUR', source: 'coingecko', freshness: 'live' }
    quotes[asset.symbol] = quote
    saveCached(asset, quote, now, 5 * 60_000)
  }
  return quotes
}

function eodhdSymbols(symbol: string) {
  if (symbol.includes('.')) return [symbol]
  // EUNL is the user's existing iShares MSCI World ETF on Xetra. Other European listings should include their EODHD suffix, e.g. CSPX.LSE.
  return symbol === 'EUNL' ? ['EUNL.XETRA'] : [`${symbol}.XETRA`]
}

function prefersEodhd(asset: AssetRequest) {
  if (asset.symbol === 'EUNL') return true
  const exchange = asset.symbol.split('.').at(-1)
  return Boolean(exchange && eodhdEuropeanExchanges.has(exchange))
}

async function fetchEodhd(assets: AssetRequest[], now: number) {
  const apiKey = process.env.EODHD_API_KEY
  const quotes: Record<string, LiveQuote> = {}
  if (!apiKey || !assets.length) return quotes
  const resolved = assets.flatMap((asset) => eodhdSymbols(asset.symbol).map((providerSymbol) => ({ asset, providerSymbol })))
  const symbols = [...new Set(resolved.map((item) => item.providerSymbol))]
  const url = new URL(`https://eodhd.com/api/real-time/${encodeURIComponent(symbols[0])}`)
  if (symbols.length > 1) url.searchParams.set('s', symbols.slice(1).join(','))
  url.searchParams.set('api_token', apiKey)
  url.searchParams.set('fmt', 'json')
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json() as EodhdQuote | EodhdQuote[]
  if (!response.ok) return quotes
  const rows = Array.isArray(data) ? data : [data]
  for (const { asset, providerSymbol } of resolved) {
    const row = rows.find((item) => item.code?.toUpperCase() === providerSymbol)
    const price = numberOrNull(row?.close)
    if (!price) continue
    const quote: LiveQuote = { price, previousClose: numberOrNull(row?.previousClose ?? row?.previous_close), currency: 'EUR', source: 'eodhd', freshness: 'delayed' }
    quotes[asset.symbol] = quote
    saveCached(asset, quote, now, 2 * 60 * 60_000)
  }
  return quotes
}

export async function GET(request: Request) {
  if (!(await getSessionUser())) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const assets = parseAssets(request)
  if (!assets.length) return Response.json({ quotes: {} })
  const now = Date.now()
  const quotes: Record<string, LiveQuote> = {}
  const missing = assets.filter((asset) => {
    const quote = getCached(asset, now)
    if (quote) quotes[asset.symbol] = quote
    return !quote
  })
  const crypto = missing.filter((asset) => asset.assetType === 'crypto')
  const marketAssets = missing.filter((asset) => asset.assetType !== 'crypto')
  const eodhdAssets = marketAssets.filter(prefersEodhd)
  const twelveAssets = marketAssets.filter((asset) => !prefersEodhd(asset))
  const unresolved = new Map(twelveAssets.map((asset) => [asset.symbol, asset]))
  const warnings: string[] = []
  try { Object.assign(quotes, await fetchCoinGecko(crypto, now)) } catch (error) { warnings.push(error instanceof Error ? error.message : 'Crypto prices are unavailable.') }
  try {
    const twelveQuotes = await fetchTwelve(twelveAssets, now)
    Object.assign(quotes, twelveQuotes)
    for (const symbol of Object.keys(twelveQuotes)) unresolved.delete(symbol)
  } catch (error) { warnings.push(error instanceof Error ? error.message : 'Market prices are unavailable.') }
  try { Object.assign(quotes, await fetchEodhd([...eodhdAssets, ...unresolved.values()], now)) } catch { warnings.push('European market prices are unavailable.') }
  return Response.json({ quotes, warnings, updatedAt: new Date().toISOString() })
}
