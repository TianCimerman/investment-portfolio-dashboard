import { getSessionUser } from '@/lib/auth'
import { createHolding, listHoldings } from '@/lib/holdings'
export const runtime = 'nodejs'
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  return Response.json({ holdings: listHoldings(user.id) })
}
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })
  try { return Response.json({ holding: createHolding(user.id, await request.json()) }, { status: 201 }) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to add holding.' }, { status: 400 }) }
}
