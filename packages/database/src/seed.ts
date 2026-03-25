import { db } from './client'
import { organisations, verticalConfigs, apiKeys, providerCredentials, usageSnapshots, optimisationRecommendations, aiAgents, promptLibrary } from './schema'
import crypto from 'node:crypto'

async function seed() {
  console.log('Seeding database...')

  // Create demo organisation
  const [org] = await db.insert(organisations).values({
    name: 'Acme Corp',
    slug: 'acme-corp',
    vertical: 'ecommerce',
    plan: 'growth',
    monthlyBudgetUsd: '2000',
  }).returning()

  console.log('Created organisation:', org.id)

  // Create vertical config
  await db.insert(verticalConfigs).values({
    organisationId: org.id,
    cachingEnabled: true,
    similarityThreshold: '0.92',
    cacheTtlSeconds: '86400',
    piiDetection: true,
    piiAction: 'detect',
    smartRouting: true,
    simpleModel: 'gpt-4o-mini',
    complexModel: 'gpt-4o',
    complexityThreshold: '0.5',
  })

  // Create API key
  const keyRaw = `ng_live_${crypto.randomBytes(24).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(keyRaw).digest('hex')
  await db.insert(apiKeys).values({
    organisationId: org.id,
    name: 'Production Key',
    keyHash,
    keyPrefix: keyRaw.slice(0, 12),
    vertical: 'ecommerce',
    rateLimitPerMinute: 120,
  })

  // Create provider credentials (placeholder encrypted keys)
  await db.insert(providerCredentials).values([
    {
      organisationId: org.id,
      provider: 'openai',
      encryptedApiKey: 'encrypted_placeholder',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      isActive: true,
      testStatus: 'success',
    },
    {
      organisationId: org.id,
      provider: 'anthropic',
      encryptedApiKey: 'encrypted_placeholder',
      models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
      isActive: true,
      testStatus: 'success',
    },
  ])

  // Create usage snapshots (last 30 days)
  const now = new Date()
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const baseRequests = 80000 + Math.floor(Math.random() * 40000)
    const baseCost = 35 + Math.random() * 20

    await db.insert(usageSnapshots).values([
      {
        organisationId: org.id,
        date: dateStr,
        provider: 'openai',
        model: 'gpt-4o',
        totalRequests: Math.floor(baseRequests * 0.4),
        totalTokens: Math.floor(baseRequests * 0.4 * 500),
        totalCostUsd: (baseCost * 0.6).toFixed(4),
        cachedRequests: Math.floor(baseRequests * 0.4 * 0.34),
        savedCostUsd: (baseCost * 0.25).toFixed(4),
        avgLatencyMs: 200 + Math.floor(Math.random() * 100),
        errorCount: Math.floor(Math.random() * 5),
      },
      {
        organisationId: org.id,
        date: dateStr,
        provider: 'openai',
        model: 'gpt-4o-mini',
        totalRequests: Math.floor(baseRequests * 0.35),
        totalTokens: Math.floor(baseRequests * 0.35 * 300),
        totalCostUsd: (baseCost * 0.15).toFixed(4),
        cachedRequests: Math.floor(baseRequests * 0.35 * 0.4),
        savedCostUsd: (baseCost * 0.1).toFixed(4),
        avgLatencyMs: 100 + Math.floor(Math.random() * 50),
        errorCount: Math.floor(Math.random() * 2),
      },
      {
        organisationId: org.id,
        date: dateStr,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        totalRequests: Math.floor(baseRequests * 0.25),
        totalTokens: Math.floor(baseRequests * 0.25 * 600),
        totalCostUsd: (baseCost * 0.25).toFixed(4),
        cachedRequests: Math.floor(baseRequests * 0.25 * 0.3),
        savedCostUsd: (baseCost * 0.08).toFixed(4),
        avgLatencyMs: 300 + Math.floor(Math.random() * 150),
        errorCount: Math.floor(Math.random() * 3),
      },
    ])
  }

  // Create optimisation recommendations
  await db.insert(optimisationRecommendations).values([
    {
      organisationId: org.id,
      type: 'cache',
      title: 'Cache "What is your refund policy?" queries',
      description: 'This query is asked 1,847 times/month and never cached. Enable semantic caching to save significantly.',
      estimatedSavingUsd: '340.00',
      priority: 'high',
      status: 'pending',
    },
    {
      organisationId: org.id,
      type: 'model_downgrade',
      title: 'Use GPT-4o-mini for FAQ responses',
      description: 'Simple FAQ responses currently use GPT-4o. Downgrading to GPT-4o-mini would reduce cost by 20x with negligible quality difference.',
      estimatedSavingUsd: '310.00',
      priority: 'high',
      status: 'pending',
    },
    {
      organisationId: org.id,
      type: 'compression',
      title: 'Enable prompt compression for product descriptions',
      description: 'Product description prompts contain 40% redundant context. Compression would reduce token usage significantly.',
      estimatedSavingUsd: '160.00',
      priority: 'medium',
      status: 'pending',
    },
    {
      organisationId: org.id,
      type: 'cache',
      title: 'Cache shipping FAQ responses',
      description: 'Shipping-related queries represent 12% of traffic with identical responses.',
      estimatedSavingUsd: '180.00',
      priority: 'medium',
      status: 'applied',
      isApplied: true,
      actualSavingUsd: '195.00',
    },
    {
      organisationId: org.id,
      type: 'duplicate',
      title: 'Deduplicate retry requests',
      description: 'Client-side retries are generating 8% duplicate requests within 5-second windows.',
      estimatedSavingUsd: '120.00',
      priority: 'medium',
      status: 'pending',
    },
    {
      organisationId: org.id,
      type: 'model_downgrade',
      title: 'Route simple translations to GPT-4o-mini',
      description: 'Translation requests under 100 tokens perform equally well on smaller models.',
      estimatedSavingUsd: '90.00',
      priority: 'low',
      status: 'applied',
      isApplied: true,
      actualSavingUsd: '105.00',
    },
    {
      organisationId: org.id,
      type: 'expensive_endpoint',
      title: 'Optimise /api/generate-description endpoint',
      description: 'This endpoint accounts for 28% of total cost. Consider batching or caching.',
      estimatedSavingUsd: '240.00',
      priority: 'high',
      status: 'pending',
    },
  ])

  // Create AI agents
  await db.insert(aiAgents).values([
    {
      organisationId: org.id,
      name: 'Customer Support Agent',
      description: 'Handles common customer inquiries about orders, shipping, and returns',
      vertical: 'ecommerce',
      systemPrompt: 'You are a helpful customer support agent for an ecommerce store. Be concise, friendly, and solution-oriented.',
      modelPreference: 'gpt-4o-mini',
      temperature: '0.3',
      toolsEnabled: ['web_search'],
      isActive: true,
      totalCalls: 12847,
    },
    {
      organisationId: org.id,
      name: 'Product Description Writer',
      description: 'Generates compelling product descriptions from specifications',
      vertical: 'ecommerce',
      systemPrompt: 'Generate compelling, SEO-optimized product descriptions. Focus on benefits, not just features.',
      modelPreference: 'gpt-4o',
      temperature: '0.7',
      toolsEnabled: [],
      isActive: true,
      totalCalls: 3421,
    },
  ])

  // Create prompt library entries
  await db.insert(promptLibrary).values([
    {
      organisationId: org.id,
      name: 'Order Status Check',
      category: 'customer_service',
      promptTemplate: 'Check the status of order {{orderId}} for customer {{customerName}}. Provide a friendly update including estimated delivery date.',
      variables: JSON.stringify([{ name: 'orderId', type: 'string' }, { name: 'customerName', type: 'string' }]),
      avgTokens: 245,
      avgCostUsd: '0.000490',
      useCount: 8934,
    },
    {
      organisationId: org.id,
      name: 'Product Description Generator',
      category: 'product',
      promptTemplate: 'Write a compelling product description for {{productName}}. Category: {{category}}. Key features: {{features}}. Target audience: {{audience}}. Keep it under 200 words.',
      variables: JSON.stringify([{ name: 'productName', type: 'string' }, { name: 'category', type: 'string' }, { name: 'features', type: 'string' }, { name: 'audience', type: 'string' }]),
      avgTokens: 512,
      avgCostUsd: '0.001024',
      useCount: 3421,
    },
    {
      organisationId: org.id,
      name: 'Return Policy Response',
      category: 'customer_service',
      promptTemplate: 'A customer is asking about our return policy for {{productType}}. Purchased {{daysSincePurchase}} days ago. Provide clear, empathetic guidance.',
      variables: JSON.stringify([{ name: 'productType', type: 'string' }, { name: 'daysSincePurchase', type: 'number' }]),
      avgTokens: 180,
      avgCostUsd: '0.000360',
      useCount: 5672,
    },
  ])

  console.log('Seed complete!')
  process.exit(0)
}

seed().catch(console.error)
