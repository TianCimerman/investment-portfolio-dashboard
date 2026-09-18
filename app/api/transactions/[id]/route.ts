import { getSessionUser } from '@/lib/auth'
import { deleteTransaction } from '@/lib/transactions'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: RouteContext<'/api/transactions/[id]'>) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  const { id } = await context.params
  const transactionId = Number(id)
  if (!Number.isSafeInteger(transactionId) || transactionId < 1) return Response.json({ error: 'Invalid transaction.' }, { status: 400 })
  try { return Response.json(deleteTransaction(user.id, transactionId)) }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove transaction.'
    return Response.json({ error: message }, { status: message === 'Transaction not found.' ? 404 : 400 })
  }
}
