import { getSessionUser } from '@/lib/auth'
import { createTransaction, listTransactions } from '@/lib/transactions'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  return Response.json({ transactions: listTransactions(user.id) })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  try { return Response.json(createTransaction(user.id, await request.json()), { status: 201 }) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to save transaction.' }, { status: 400 }) }
}
