import { ofetch } from 'ofetch'

export const http = ofetch.create({
  timeout: 10_000, // 10s default timeout
  retry: 2, // retry twice on failure
  retryDelay: 500,
})
