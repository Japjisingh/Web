import { db } from '@neuralgate/database/client'
import { providerCredentials, aiRequests } from '@neuralgate/database/schema'
import { eq, and } from 'drizzle-orm'
import { getProviderConfig, detectProvider, calculateCost } from '../lib/providers'
import { generateCacheKey, getCachedResponse, setCachedResponse } from '../lib/cache'
import { requestQueue } from '../lib/queue'

interface ProxyRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
  [key: string]: unknown
}

interface ProxyResult {
  response: unknown
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
  cached: boolean
  cacheKey?: string
}

export async function proxyRequest(
  organisationId: string,
  apiKeyId: string,
  body: ProxyRequest,
  endpoint: string,
): Promise<ProxyResult> {
  const startTime = Date.now()
  const provider = detectProvider(body.model)
  const config = getProviderConfig(provider)

  if (!config) {
    throw new Error(`Unsupported provider for model: ${body.model}`)
  }

  // Check cache
  const cacheKey = generateCacheKey(body.model, body.messages)
  const cachedResponse = await getCachedResponse(cacheKey)

  if (cachedResponse) {
    const parsed = JSON.parse(cachedResponse)
    const latencyMs = Date.now() - startTime

    // Log cached request
    await logRequest({
      organisationId,
      apiKeyId,
      provider,
      model: body.model,
      endpoint,
      inputTokens: parsed.usage?.prompt_tokens || 0,
      outputTokens: parsed.usage?.completion_tokens || 0,
      cost: 0,
      latencyMs,
      statusCode: 200,
      cached: true,
      cacheKey,
    })

    return {
      response: parsed,
      model: body.model,
      provider,
      inputTokens: parsed.usage?.prompt_tokens || 0,
      outputTokens: parsed.usage?.completion_tokens || 0,
      cost: 0,
      latencyMs,
      cached: true,
      cacheKey,
    }
  }

  // Get provider credentials
  const creds = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.organisationId, organisationId),
        eq(providerCredentials.provider, provider),
        eq(providerCredentials.isActive, true),
      ),
    )
    .limit(1)

  if (creds.length === 0) {
    throw new Error(`No active credentials found for provider: ${provider}`)
  }

  // TODO: decrypt API key in production
  const providerApiKey = creds[0].encryptedApiKey

  // Forward request to provider
  const providerUrl = `${config.baseUrl}${config.chatPath}`
  const headers = {
    'Content-Type': 'application/json',
    ...config.authHeader(providerApiKey),
  }

  let response: Response
  let attempts = 0
  const maxAttempts = 3

  while (true) {
    attempts++
    try {
      response = await fetch(providerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (response.status !== 429 && response.status < 500) break
      if (attempts >= maxAttempts) break

      // Exponential backoff on 429/5xx
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts - 1)))
    } catch (err) {
      if (attempts >= maxAttempts) throw err
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts - 1)))
    }
  }

  const latencyMs = Date.now() - startTime
  const responseBody = await response!.json()

  const inputTokens = responseBody.usage?.prompt_tokens || responseBody.usage?.input_tokens || 0
  const outputTokens = responseBody.usage?.completion_tokens || responseBody.usage?.output_tokens || 0
  const cost = calculateCost(body.model, inputTokens, outputTokens)

  // Cache successful responses
  if (response!.ok) {
    await setCachedResponse(cacheKey, JSON.stringify(responseBody))
  }

  // Log request async via queue
  await logRequest({
    organisationId,
    apiKeyId,
    provider,
    model: body.model,
    endpoint,
    inputTokens,
    outputTokens,
    cost,
    latencyMs,
    statusCode: response!.status,
    cached: false,
  })

  return {
    response: responseBody,
    model: body.model,
    provider,
    inputTokens,
    outputTokens,
    cost,
    latencyMs,
    cached: false,
  }
}

async function logRequest(data: {
  organisationId: string
  apiKeyId: string
  provider: string
  model: string
  endpoint: string
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
  statusCode: number
  cached: boolean
  cacheKey?: string
}) {
  try {
    await requestQueue.add('log-request', data)
  } catch {
    // Fallback: write directly to DB if queue unavailable
    await db.insert(aiRequests).values({
      organisationId: data.organisationId,
      apiKeyId: data.apiKeyId,
      provider: data.provider,
      model: data.model,
      endpoint: data.endpoint,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.inputTokens + data.outputTokens,
      costUsd: String(data.cost),
      latencyMs: data.latencyMs,
      statusCode: data.statusCode,
      cached: data.cached,
      cacheKey: data.cacheKey,
    })
  }
}
