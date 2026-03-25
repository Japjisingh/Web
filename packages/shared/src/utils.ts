export function formatCurrency(value: number | string, currency = '£'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (num >= 1000) {
    return `${currency}${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (num >= 1) {
    return `${currency}${num.toFixed(2)}`
  }
  return `${currency}${num.toFixed(4)}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-GB')
}

export function formatTokens(input: number, output: number): string {
  return `${formatCompact(input)} → ${formatCompact(output)}`
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-GB')
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  }
  const p = pricing[model] || { input: 1.00, output: 3.00 }
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'ng_live_'
  for (let i = 0; i < 48; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getLatencyColor(ms: number): string {
  if (ms < 100) return 'var(--success)'
  if (ms < 500) return 'var(--warning)'
  return 'var(--danger)'
}

export function getChangeColor(change: number, inverted = false): string {
  const isPositive = inverted ? change < 0 : change > 0
  return isPositive ? 'var(--success)' : 'var(--danger)'
}
