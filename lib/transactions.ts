import 'server-only'

import { db } from '@/lib/db'
import { listHoldings } from '@/lib/holdings'
import type { AssetType, Holding, PortfolioTransaction } from '@/lib/portfolio'

type TransactionRow = Omit<PortfolioTransaction, 'type'> & { type: 'buy' | 'sell' }

export function listTransactions(userId: number): PortfolioTransaction[] {
  return db.prepare(`SELECT id, symbol, name, asset_type AS assetType, transaction_type AS type, quantity, unit_price AS unitPrice, transaction_date AS transactionDate, notes FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, id DESC`).all(userId) as TransactionRow[]
}

function validateDate(value: unknown) {
  const date = typeof value === 'string' ? value : ''
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Enter a valid transaction date.')
  return date
}

export function createTransaction(userId: number, input: unknown): { transaction: PortfolioTransaction; holdings: Holding[] } {
  if (!input || typeof input !== 'object') throw new Error('Invalid transaction.')
  const values = input as Record<string, unknown>
  const symbol = typeof values.symbol === 'string' ? values.symbol.trim().toUpperCase() : ''
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const assetType = values.assetType
  const type = values.type
  const quantity = Number(values.quantity)
  const unitPrice = Number(values.unitPrice)
  const transactionDate = validateDate(values.transactionDate)
  const notes = typeof values.notes === 'string' ? values.notes.trim().slice(0, 500) : ''
  if (!/^[A-Z0-9./:-]{1,24}$/.test(symbol)) throw new Error('Enter a valid ticker or pair, such as AAPL or BTC/USD.')
  if (name.length < 1 || name.length > 80) throw new Error('Asset name must be between 1 and 80 characters.')
  if (assetType !== 'stock' && assetType !== 'etf' && assetType !== 'crypto') throw new Error('Choose stock, ETF, or crypto.')
  if (type !== 'buy' && type !== 'sell') throw new Error('Choose buy or sell.')
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e12) throw new Error('Enter a valid quantity.')
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1e12) throw new Error('Enter a valid unit price.')

  const save = db.transaction(() => {
    const holding = db.prepare('SELECT id, quantity, average_buy_price AS averageBuyPrice FROM holdings WHERE user_id = ? AND symbol = ? AND asset_type = ?').get(userId, symbol, assetType) as { id: number; quantity: number; averageBuyPrice: number } | undefined
    if (type === 'sell' && (!holding || holding.quantity + 1e-10 < quantity)) throw new Error('You cannot sell more units than are currently in this portfolio.')
    const result = db.prepare('INSERT INTO transactions (user_id, symbol, name, asset_type, transaction_type, quantity, unit_price, transaction_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(userId, symbol, name, assetType, type, quantity, unitPrice, transactionDate, notes)
    if (type === 'buy') {
      if (holding) {
        const nextQuantity = holding.quantity + quantity
        const nextAverage = ((holding.quantity * holding.averageBuyPrice) + (quantity * unitPrice)) / nextQuantity
        db.prepare('UPDATE holdings SET name = ?, quantity = ?, average_buy_price = ? WHERE id = ?').run(name, nextQuantity, nextAverage, holding.id)
      } else db.prepare('INSERT INTO holdings (user_id, symbol, name, asset_type, quantity, average_buy_price) VALUES (?, ?, ?, ?, ?, ?)').run(userId, symbol, name, assetType, quantity, unitPrice)
    } else if (holding) {
      const nextQuantity = holding.quantity - quantity
      if (nextQuantity <= 1e-10) db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id)
      else db.prepare('UPDATE holdings SET quantity = ? WHERE id = ?').run(nextQuantity, holding.id)
    }
    return { id: Number(result.lastInsertRowid), symbol, name, assetType: assetType as AssetType, type, quantity, unitPrice, transactionDate, notes } satisfies PortfolioTransaction
  })
  return { transaction: save(), holdings: listHoldings(userId) }
}

export function deleteTransaction(userId: number, transactionId: number): { holdings: Holding[] } {
  const remove = db.transaction(() => {
    const transaction = db.prepare('SELECT id, symbol, name, asset_type AS assetType, transaction_type AS type, quantity, unit_price AS unitPrice FROM transactions WHERE id = ? AND user_id = ?').get(transactionId, userId) as Pick<PortfolioTransaction, 'id' | 'symbol' | 'name' | 'assetType' | 'type' | 'quantity' | 'unitPrice'> | undefined
    if (!transaction) throw new Error('Transaction not found.')
    const holding = db.prepare('SELECT id, quantity, average_buy_price AS averageBuyPrice FROM holdings WHERE user_id = ? AND symbol = ? AND asset_type = ? ORDER BY id LIMIT 1').get(userId, transaction.symbol, transaction.assetType) as { id: number; quantity: number; averageBuyPrice: number } | undefined

    if (transaction.type === 'buy' && holding) {
      const nextQuantity = holding.quantity - transaction.quantity
      if (nextQuantity < -1e-10) throw new Error('Remove later sell transactions first, then remove this buy.')
      const sales = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM transactions WHERE user_id = ? AND symbol = ? AND asset_type = ? AND transaction_type = 'sell'").get(userId, transaction.symbol, transaction.assetType) as { quantity: number }
      const soldQuantity = Number(sales.quantity)
      const totalPurchasedQuantity = holding.quantity + soldQuantity
      const nextPurchasedQuantity = totalPurchasedQuantity - transaction.quantity
      const nextCost = (holding.averageBuyPrice * totalPurchasedQuantity) - (transaction.unitPrice * transaction.quantity)
      if (nextQuantity <= 1e-10) db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id)
      else db.prepare('UPDATE holdings SET quantity = ?, average_buy_price = ? WHERE id = ?').run(nextQuantity, nextPurchasedQuantity > 1e-10 ? Math.max(0, nextCost / nextPurchasedQuantity) : holding.averageBuyPrice, holding.id)
    } else if (transaction.type === 'sell') {
      if (holding) db.prepare('UPDATE holdings SET quantity = ? WHERE id = ?').run(holding.quantity + transaction.quantity, holding.id)
      else {
        const buys = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity, COALESCE(SUM(quantity * unit_price), 0) AS cost, MAX(name) AS name FROM transactions WHERE user_id = ? AND symbol = ? AND asset_type = ? AND transaction_type = 'buy'").get(userId, transaction.symbol, transaction.assetType) as { quantity: number; cost: number; name: string | null }
        if (buys.quantity <= 0) throw new Error('This sale cannot be removed because its original purchase is unavailable.')
        db.prepare('INSERT INTO holdings (user_id, symbol, name, asset_type, quantity, average_buy_price) VALUES (?, ?, ?, ?, ?, ?)').run(userId, transaction.symbol, buys.name ?? transaction.name, transaction.assetType, transaction.quantity, buys.cost / buys.quantity)
      }
    }
    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(transactionId, userId)
  })
  remove()
  return { holdings: listHoldings(userId) }
}
