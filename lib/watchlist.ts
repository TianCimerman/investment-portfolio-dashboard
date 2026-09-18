import 'server-only'
import { db } from '@/lib/db'
import type { AssetType, WatchlistItem } from '@/lib/portfolio'

type WatchlistRow = WatchlistItem

export function listWatchlist(userId: number): WatchlistItem[] {
  return db.prepare('SELECT id, symbol, name, asset_type AS assetType FROM watchlist_items WHERE user_id = ? ORDER BY created_at DESC').all(userId) as WatchlistRow[]
}

export function createWatchlistItem(userId: number, input: unknown): WatchlistItem {
  if (!input || typeof input !== 'object') throw new Error('Invalid watchlist asset.')
  const values = input as Record<string, unknown>
  const symbol = typeof values.symbol === 'string' ? values.symbol.trim().toUpperCase() : ''
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const assetType = values.assetType
  if (!/^[A-Z0-9./:-]{1,24}$/.test(symbol)) throw new Error('Enter a valid ticker or pair, such as AAPL or BTC.')
  if (name.length < 1 || name.length > 80) throw new Error('Asset name must be between 1 and 80 characters.')
  if (assetType !== 'stock' && assetType !== 'etf' && assetType !== 'crypto') throw new Error('Choose stock, ETF, or crypto.')
  try {
    const result = db.prepare('INSERT INTO watchlist_items (user_id, symbol, name, asset_type) VALUES (?, ?, ?, ?)').run(userId, symbol, name, assetType)
    return { id: Number(result.lastInsertRowid), symbol, name, assetType: assetType as AssetType }
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new Error('This asset is already on your watchlist.')
    throw error
  }
}

export function deleteWatchlistItem(userId: number, itemId: number) {
  return db.prepare('DELETE FROM watchlist_items WHERE id = ? AND user_id = ?').run(itemId, userId).changes > 0
}
