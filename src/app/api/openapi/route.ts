import { getOpenApiSpec } from '@/lib/openapi/registry'

export async function GET() {
  return Response.json(getOpenApiSpec())
}
