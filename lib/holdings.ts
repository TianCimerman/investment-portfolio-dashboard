import 'server-only'
import { db } from '@/lib/db'
import type { AssetType, Holding } from '@/lib/portfolio'

type HoldingRow = { id: number; symbol: string; name: string; assetType: AssetType; quantity: number; averageBuyPrice: number; createdAt: string }
const asHolding = (row: HoldingRow): Holding => ({ id: row.id, symbol: row.symbol, name: row.name, assetType: row.assetType, quantity: row.quantity, averageBuyPrice: row.averageBuyPrice })

export function listHoldings(userId: number): Holding[] {
  const rows = db.prepare('SELECT id, symbol, name, asset_type AS assetType, quantity, average_buy_price AS averageBuyPrice, created_at AS createdAt FROM holdings WHERE user_id = ? ORDER BY created_at DESC').all(userId) as HoldingRow[]
  const typePriority: Record<AssetType, number> = { crypto: 3, etf: 2, stock: 1 }
  const grouped = new Map<string, HoldingRow>()
  for (const row of rows) {
    const existing = grouped.get(row.symbol)
    if (!existing) { grouped.set(row.symbol, row); continue }
    const totalQuantity = existing.quantity + row.quantity
    const preferred = typePriority[row.assetType] > typePriority[existing.assetType] ? row : existing
    grouped.set(row.symbol, {
      ...preferred,
      id: Math.min(existing.id, row.id),
      name: preferred.name,
      quantity: totalQuantity,
      averageBuyPrice: totalQuantity ? ((existing.quantity * existing.averageBuyPrice) + (row.quantity * row.averageBuyPrice)) / totalQuantity : 0,
      createdAt: existing.createdAt > row.createdAt ? existing.createdAt : row.createdAt,
    })
  }
  return [...grouped.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(asHolding)
}
export function createHolding(userId: number, input: unknown): Holding {
  if (!input || typeof input !== 'object') throw new Error('Invalid holding.')
  const values = input as Record<string, unknown>
  const symbol = typeof values.symbol === 'string' ? values.symbol.trim().toUpperCase() : ''
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const assetType = values.assetType
  const quantity = Number(values.quantity)
  const averageBuyPrice = Number(values.averageBuyPrice)
  if (!/^[A-Z0-9./:-]{1,24}$/.test(symbol)) throw new Error('Enter a valid ticker or pair, such as AAPL or BTC/USD.')
  if (name.length < 1 || name.length > 80) throw new Error('Asset name must be between 1 and 80 characters.')
  if (assetType !== 'stock' && assetType !== 'etf' && assetType !== 'crypto') throw new Error('Choose stock, ETF, or crypto.')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e12) throw new Error('Enter a valid quantity.')
  if (!Number.isFinite(averageBuyPrice) || averageBuyPrice < 0 || averageBuyPrice > 1e12) throw new Error('Enter a valid average buy price.')
  const result = db.prepare('INSERT INTO holdings (user_id, symbol, name, asset_type, quantity, average_buy_price) VALUES (?, ?, ?, ?, ?, ?)').run(userId, symbol, name, assetType, quantity, averageBuyPrice)
  return { id: Number(result.lastInsertRowid), symbol, name, assetType, quantity, averageBuyPrice }
}
export function deleteHolding(userId: number, holdingId: number) {
  const remove = db.transaction(() => {
    const holding = db.prepare('SELECT symbol, asset_type AS assetType FROM holdings WHERE id = ? AND user_id = ?').get(holdingId, userId) as Pick<Holding, 'symbol' | 'assetType'> | undefined
    if (!holding) return null
    db.prepare('DELETE FROM holdings WHERE user_id = ? AND symbol = ? AND asset_type = ?').run(userId, holding.symbol, holding.assetType)
    db.prepare('DELETE FROM transactions WHERE user_id = ? AND symbol = ? AND asset_type = ?').run(userId, holding.symbol, holding.assetType)
    return holding
  })
  const deleted = remove()
  return deleted ? { ...deleted, holdings: listHoldings(userId) } : null
}
