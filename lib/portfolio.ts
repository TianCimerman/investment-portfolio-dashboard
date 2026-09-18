export type AssetType = 'stock' | 'etf' | 'crypto'

export type Holding = { id: number; symbol: string; name: string; assetType: AssetType; quantity: number; averageBuyPrice: number }
export type QuoteSource = 'coingecko' | 'twelve-data' | 'eodhd'
export type QuoteFreshness = 'live' | 'delayed'

export type LiveQuote = {
  price: number
  previousClose: number | null
  currency: string
  source: QuoteSource
  freshness: QuoteFreshness
}

export type PortfolioTransaction = {
  id: number
  symbol: string
  name: string
  assetType: AssetType
  type: 'buy' | 'sell'
  quantity: number
  unitPrice: number
  transactionDate: string
  notes: string
}

export type WatchlistItem = {
  id: number
  symbol: string
  name: string
  assetType: AssetType
}
