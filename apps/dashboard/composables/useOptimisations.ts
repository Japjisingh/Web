import type { OptimisationRecommendation } from '@neuralgate/shared/types'

export function useOptimisations() {
  const { request, orgId } = useApi()
  const toast = useToast()

  const recommendations = ref<OptimisationRecommendation[]>([])
  const loading = ref(false)

  async function fetch() {
    if (!orgId.value) return
    loading.value = true
    try {
      recommendations.value = await request<OptimisationRecommendation[]>(
        `/optimisations/${orgId.value}`,
      )
    } catch (err) {
      console.error('Failed to fetch optimisations:', err)
    } finally {
      loading.value = false
    }
  }

  async function apply(id: string) {
    // Optimistic update
    const idx = recommendations.value.findIndex((r) => r.id === id)
    if (idx === -1) return

    const prev = { ...recommendations.value[idx] }
    recommendations.value[idx] = {
      ...recommendations.value[idx],
      isApplied: true,
      status: 'applied',
      appliedAt: new Date(),
    }

    try {
      await request(`/optimisations/${id}/apply`, { method: 'PATCH' })
      toast.success('Recommendation applied successfully')
    } catch (err) {
      // Rollback on failure
      recommendations.value[idx] = prev as OptimisationRecommendation
      toast.error('Failed to apply recommendation')
    }
  }

  async function dismiss(id: string) {
    const idx = recommendations.value.findIndex((r) => r.id === id)
    if (idx === -1) return

    const prev = { ...recommendations.value[idx] }
    recommendations.value[idx] = {
      ...recommendations.value[idx],
      status: 'dismissed',
    }

    try {
      await request(`/optimisations/${id}/dismiss`, { method: 'PATCH' })
      toast.info('Recommendation dismissed')
    } catch (err) {
      recommendations.value[idx] = prev as OptimisationRecommendation
      toast.error('Failed to dismiss recommendation')
    }
  }

  // Computed groupings
  const pending = computed(() =>
    recommendations.value.filter((r) => r.status === 'pending'),
  )

  const applied = computed(() =>
    recommendations.value.filter((r) => r.isApplied),
  )

  const dismissed = computed(() =>
    recommendations.value.filter((r) => r.status === 'dismissed'),
  )

  const totalIdentifiedSaving = computed(() =>
    pending.value.reduce((s, r) => s + parseFloat(r.estimatedSavingUsd), 0),
  )

  const totalAppliedSaving = computed(() =>
    applied.value.reduce(
      (s, r) => s + parseFloat(r.actualSavingUsd || r.estimatedSavingUsd),
      0,
    ),
  )

  const byType = computed(() => {
    const groups: Record<string, OptimisationRecommendation[]> = {}
    for (const r of recommendations.value) {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type].push(r)
    }
    return groups
  })

  return {
    recommendations: readonly(recommendations),
    loading: readonly(loading),
    pending,
    applied,
    dismissed,
    totalIdentifiedSaving,
    totalAppliedSaving,
    byType,
    fetch,
    apply,
    dismiss,
  }
}
