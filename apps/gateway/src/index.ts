import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import proxy from './routes/proxy'
import agents from './routes/agents'
import playground from './routes/playground'
import experimentRoutes from './routes/experiments'
import batch from './routes/batch'
import forecast from './routes/forecast'
import dashboardApi from './routes/dashboard-api'

const app = new Hono()

// Global middleware
app.use('*', cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3000',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use('*', logger())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Proxy routes (OpenAI-compatible)
app.route('/', proxy)

// 2026 feature routes
app.route('/v1/agents', agents)
app.route('/v1/playground', playground)
app.route('/v1/experiment', experimentRoutes)
app.route('/v1/batch', batch)
app.route('/v1/forecast', forecast)

// Dashboard API
app.route('/api', dashboardApi)

const port = parseInt(process.env.GATEWAY_PORT || '4000')
console.log(`NeuralGate Gateway running on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
