import { ok } from '@/lib/api-response'

export async function GET() {
  return ok({ message: 'Hello, world!' })
}
