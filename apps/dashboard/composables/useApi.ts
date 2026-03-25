const BASE_URL = import.meta.env?.VITE_GATEWAY_URL || 'http://localhost:4000'

interface FetchOptions {
  method?: string
  body?: unknown
  params?: Record<string, string>
}

export function useApi() {
  const orgId = useOrgId()

  async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/api${path}`)
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `API error: ${res.status}`)
    }

    return res.json()
  }

  return { request, orgId }
}

// Simple org ID store — in production this comes from auth session
function useOrgId() {
  return useState('orgId', () => '')
}
