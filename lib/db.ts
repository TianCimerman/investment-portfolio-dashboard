import 'server-only'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const databasePath = join(process.cwd(), '.data', 'northstar.sqlite')
function createDatabase() {
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
    CREATE TABLE IF NOT EXISTS holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol TEXT NOT NULL, name TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'crypto')), quantity REAL NOT NULL CHECK(quantity > 0), average_buy_price REAL NOT NULL CHECK(average_buy_price >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS holdings_user_id_idx ON holdings(user_id);
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol TEXT NOT NULL, name TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'crypto')), transaction_type TEXT NOT NULL CHECK(transaction_type IN ('buy', 'sell')), quantity REAL NOT NULL CHECK(quantity > 0), unit_price REAL NOT NULL CHECK(unit_price >= 0), transaction_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, transaction_date DESC, id DESC);
    CREATE TABLE IF NOT EXISTS watchlist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol TEXT NOT NULL, name TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'crypto')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, symbol, asset_type));
    CREATE INDEX IF NOT EXISTS watchlist_items_user_id_idx ON watchlist_items(user_id);
  `)
  return database
}
const globalForDatabase = globalThis as unknown as { northstarDatabase?: Database.Database }
export const db = globalForDatabase.northstarDatabase ?? createDatabase()
// Apply additive migrations even when Next.js development mode reuses a previously opened database connection.
db.exec(`
  CREATE TABLE IF NOT EXISTS watchlist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol TEXT NOT NULL, name TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'crypto')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, symbol, asset_type));
  CREATE INDEX IF NOT EXISTS watchlist_items_user_id_idx ON watchlist_items(user_id);
`)
if (process.env.NODE_ENV !== 'production') globalForDatabase.northstarDatabase = db
