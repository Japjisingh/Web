export function useCountUp(target: Ref<number>, duration = 800) {
  const display = ref(0)
  let frame: number | null = null

  function animate(from: number, to: number) {
    if (frame) cancelAnimationFrame(frame)
    const start = performance.now()

    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = from + (to - from) * eased

      if (progress < 1) {
        frame = requestAnimationFrame(step)
      } else {
        display.value = to
      }
    }

    frame = requestAnimationFrame(step)
  }

  watch(target, (newVal, oldVal) => {
    animate(oldVal || 0, newVal)
  }, { immediate: true })

  onUnmounted(() => {
    if (frame) cancelAnimationFrame(frame)
  })

  return display
}
