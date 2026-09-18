import 'server-only'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'northstar_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30
export type SessionUser = { id: number; username: string }
type UserRow = SessionUser & { passwordHash: string }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

function validateCredentials(username: unknown, password: unknown) {
  const cleanUsername = typeof username === 'string' ? username.trim() : ''
  const cleanPassword = typeof password === 'string' ? password : ''
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(cleanUsername)) throw new Error('Username must be 3–32 characters and use only letters, numbers, dots, dashes, or underscores.')
  if (cleanPassword.length < 10) throw new Error('Password must be at least 10 characters long.')
  return { username: cleanUsername, password: cleanPassword }
}

async function createSession(user: SessionUser) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
  db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(token), expiresAt.toISOString())
  ;(await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt, path: '/' })
}

export async function createAccount(usernameInput: unknown, passwordInput: unknown) {
  const { username, password } = validateCredentials(usernameInput, passwordInput)
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw new Error('That username is already in use.')
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, await bcrypt.hash(password, 12))
  const user = { id: Number(result.lastInsertRowid), username }
  await createSession(user)
  return user
}

export async function signIn(usernameInput: unknown, passwordInput: unknown) {
  const username = typeof usernameInput === 'string' ? usernameInput.trim() : ''
  const password = typeof passwordInput === 'string' ? passwordInput : ''
  const user = db.prepare('SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?').get(username) as UserRow | undefined
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new Error('Invalid username or password.')
  const publicUser = { id: user.id, username: user.username }
  await createSession(publicUser)
  return publicUser
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return (db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(hashToken(token), new Date().toISOString()) as SessionUser | undefined) ?? null
}

export async function signOut() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  cookieStore.delete(SESSION_COOKIE)
}
