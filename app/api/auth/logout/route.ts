import { signOut } from '@/lib/auth'
export const runtime = 'nodejs'
export async function POST() { await signOut(); return Response.json({ ok: true }) }
