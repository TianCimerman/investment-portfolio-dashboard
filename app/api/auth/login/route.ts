import { signIn } from '@/lib/auth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    return Response.json({ user: await signIn(username, password) })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to sign in.' }, { status: 401 })
  }
}
