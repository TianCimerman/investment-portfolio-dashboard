import { getSessionUser } from '@/lib/auth'
import { createWatchlistItem, listWatchlist } from '@/lib/watchlist'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  return Response.json({ items: listWatchlist(user.id) })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  try { return Response.json({ item: createWatchlistItem(user.id, await request.json()) }, { status: 201 }) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to add watchlist asset.' }, { status: 400 }) }
}
