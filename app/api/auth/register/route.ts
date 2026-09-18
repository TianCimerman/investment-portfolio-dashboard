import { createAccount } from '@/lib/auth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    return Response.json({ user: await createAccount(username, password) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account.'
    return Response.json({ error: message }, { status: message.includes('already') ? 409 : 400 })
  }
}
