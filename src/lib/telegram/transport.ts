/**
 * lib/telegram/transport.ts — HTTP transport wrapping native fetch with a base URL.
 */

export interface HttpTransportOptions {
  baseUrl?: string
  headers?: Record<string, string>
}

export class HttpTransport {
  baseUrl: string
  defaultHeaders: Record<string, string>

  constructor(baseUrl: string = 'https://api.telegram.org', options: HttpTransportOptions = {}) {
    this.baseUrl = (options.baseUrl ?? baseUrl).replace(/\/+$/, '')
    this.defaultHeaders = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  }

  buildUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`
    return `${this.baseUrl}${p}`
  }

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url =
      typeof input === 'string' && !/^https?:\/\//i.test(input) ? this.buildUrl(input) : input
    return fetch(url as any, init)
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const res = await this.fetch(path, {
      method,
      headers: { ...this.defaultHeaders, ...(init?.headers ?? {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    })
    const text = await res.text()
    try {
      return JSON.parse(text) as T
    } catch {
      return { ok: res.ok, status: res.status, text } as unknown as T
    }
  }

  async get<T = any>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, init)
  }

  async post<T = any>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, init)
  }

  async put<T = any>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, init)
  }

  async delete<T = any>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, body, init)
  }
}

export default HttpTransport
