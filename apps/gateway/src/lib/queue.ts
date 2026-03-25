import { Queue } from 'bullmq'
import { redis } from './redis'

export const requestQueue = new Queue('request-processing', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
})

export const analyticsQueue = new Queue('analytics-aggregation', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})
