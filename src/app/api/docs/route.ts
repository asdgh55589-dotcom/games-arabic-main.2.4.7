import { ApiReference } from '@scalar/nextjs-api-reference'

// NOTE: @scalar/nextjs-api-reference v0.11 exposes a route handler
// (not a React component), so the interactive docs UI is served here
// and /docs redirects to this route.
const handler = ApiReference({
  spec: { url: '/api/openapi' },
})

export async function GET() {
  return handler()
}
