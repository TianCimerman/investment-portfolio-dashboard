import { getSessionUser } from '@/lib/auth'
import { deleteHolding } from '@/lib/holdings'
export const runtime = 'nodejs'
export async function DELETE(_request: Request, context: RouteContext<'/api/holdings/[id]'>) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await context.params
  const holdingId = Number(id)
  if (!Number.isSafeInteger(holdingId) || holdingId < 1) return Response.json({ error: 'Invalid holding.' }, { status: 400 })
  const deleted = deleteHolding(user.id, holdingId)
  if (!deleted) return Response.json({ error: 'Holding not found.' }, { status: 404 })
  return Response.json({ ok: true, ...deleted })
}
