import { getSessionUser } from '@/lib/auth'
import { deleteWatchlistItem } from '@/lib/watchlist'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: RouteContext<'/api/watchlist/[id]'>) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await context.params
  const itemId = Number(id)
  if (!Number.isSafeInteger(itemId) || itemId < 1) return Response.json({ error: 'Invalid watchlist item.' }, { status: 400 })
  if (!deleteWatchlistItem(user.id, itemId)) return Response.json({ error: 'Watchlist item not found.' }, { status: 404 })
  return Response.json({ ok: true })
}
