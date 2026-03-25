import { Hono } from 'hono'
import { apiKeyAuth } from '../middleware/auth'
import { db } from '@neuralgate/database/client'
import { usageSnapshots } from '@neuralgate/database/schema'
import { eq, gte, sql } from 'drizzle-orm'

const forecast = new Hono()

forecast.use('*', apiKeyAuth)

forecast.get('/', async (c) => {
  const apiKey = c.get('apiKey' as never) as { organisationId: string }
  const days = parseInt(c.req.query('days') || '30')

  // Get last 14 days of usage data
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const usage = await db
    .select({
      date: usageSnapshots.date,
      totalCost: sql<string>`sum(${usageSnapshots.totalCostUsd})`,
      totalRequests: sql<number>`sum(${usageSnapshots.totalRequests})`,
    })
    .from(usageSnapshots)
    .where(
      eq(usageSnapshots.organisationId, apiKey.organisationId),
    )
    .groupBy(usageSnapshots.date)
    .orderBy(usageSnapshots.date)

  if (usage.length < 3) {
    return c.json({
      error: 'Insufficient data for forecast (need at least 3 days)',
      data: [],
    }, 400)
  }

  // Calculate daily averages with day-of-week adjustment
  const dailyCosts = usage.map((u) => ({
    date: u.date,
    cost: parseFloat(u.totalCost),
    dayOfWeek: new Date(u.date).getDay(),
  }))

  const avgDaily = dailyCosts.reduce((sum, d) => sum + d.cost, 0) / dailyCosts.length

  // Day-of-week multipliers
  const dayMultipliers = new Map<number, number>()
  for (let day = 0; day < 7; day++) {
    const dayData = dailyCosts.filter((d) => d.dayOfWeek === day)
    if (dayData.length > 0) {
      const dayAvg = dayData.reduce((s, d) => s + d.cost, 0) / dayData.length
      dayMultipliers.set(day, dayAvg / avgDaily)
    } else {
      dayMultipliers.set(day, 1)
    }
  }

  // Linear trend
  const n = dailyCosts.length
  const xMean = (n - 1) / 2
  const yMean = avgDaily
  let numerator = 0
  let denominator = 0
  dailyCosts.forEach((d, i) => {
    numerator += (i - xMean) * (d.cost - yMean)
    denominator += (i - xMean) ** 2
  })
  const slope = denominator !== 0 ? numerator / denominator : 0

  // Generate forecast
  const forecastData = []
  const today = new Date()
  for (let i = 1; i <= days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()
    const baseProjection = avgDaily + slope * (n + i)
    const adjusted = baseProjection * (dayMultipliers.get(dayOfWeek) || 1)

    // Confidence interval widens with time
    const uncertainty = 0.1 + (i / days) * 0.3
    forecastData.push({
      date: date.toISOString().split('T')[0],
      projected: Math.max(0, adjusted).toFixed(4),
      low: Math.max(0, adjusted * (1 - uncertainty)).toFixed(4),
      high: (adjusted * (1 + uncertainty)).toFixed(4),
    })
  }

  const projectedTotal = forecastData.reduce((s, d) => s + parseFloat(d.projected), 0)

  return c.json({
    forecast: forecastData,
    summary: {
      projectedTotal: projectedTotal.toFixed(2),
      dailyAverage: avgDaily.toFixed(4),
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      trendPerDay: slope.toFixed(4),
      confidence: 'medium',
    },
    historical: dailyCosts.map((d) => ({
      date: d.date,
      cost: d.cost.toFixed(4),
    })),
  })
})

export default forecast
