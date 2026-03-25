<template>
  <div class="gauge-chart chart-enter" :style="{ height: `${height}px` }">
    <VChart :option="chartOption" :autoresize="true" />
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  value: number
  max?: number
  height?: number
  label?: string
}>(), {
  max: 100,
  height: 200,
})

const percentage = computed(() => (props.value / props.max) * 100)
const gaugeColor = computed(() => {
  if (percentage.value > 100) return '#ff4757'
  if (percentage.value > 80) return '#f5a623'
  return '#5b5ef4'
})

const chartOption = computed(() => ({
  series: [{
    type: 'gauge',
    startAngle: 200,
    endAngle: -20,
    min: 0,
    max: props.max,
    progress: {
      show: true,
      width: 12,
      itemStyle: { color: gaugeColor.value },
    },
    axisLine: { lineStyle: { width: 12, color: [[1, '#1e1e28']] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    pointer: { show: false },
    anchor: { show: false },
    title: {
      show: !!props.label,
      offsetCenter: [0, '60%'],
      fontSize: 12,
      color: '#8888a0',
      fontFamily: 'Geist, sans-serif',
    },
    detail: {
      valueAnimation: true,
      fontSize: 22,
      fontFamily: 'Berkeley Mono, monospace',
      fontWeight: 'bold',
      color: '#ededf0',
      offsetCenter: [0, '20%'],
      formatter: `${percentage.value.toFixed(0)}%`,
    },
    data: [{ value: props.value, name: props.label || '' }],
  }],
  animation: true,
  animationDuration: 800,
  animationEasing: 'cubicOut',
}))
</script>

<style scoped>
.gauge-chart { width: 100%; }
</style>
