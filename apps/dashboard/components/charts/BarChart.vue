<template>
  <div class="bar-chart chart-enter" :style="{ height: `${height}px` }">
    <VChart :option="chartOption" :autoresize="true" />
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  labels: string[]
  datasets: Array<{ name: string; data: number[]; color?: string }>
  height?: number
  horizontal?: boolean
  stacked?: boolean
}>(), {
  height: 300,
  horizontal: false,
  stacked: false,
})

const chartOption = computed(() => {
  const categoryAxis = {
    type: 'category' as const,
    data: props.labels,
    axisLine: { lineStyle: { color: '#1e1e28' } },
    axisLabel: { color: '#8888a0', fontSize: 10, fontFamily: 'Berkeley Mono, monospace' },
    axisTick: { show: false },
  }

  const valueAxis = {
    type: 'value' as const,
    splitLine: { lineStyle: { color: '#1e1e28', opacity: 0.15 } },
    axisLabel: { color: '#55556a', fontSize: 10, fontFamily: 'Berkeley Mono, monospace' },
    axisLine: { show: false },
    axisTick: { show: false },
  }

  return {
    grid: { top: 20, right: 20, bottom: 30, left: props.horizontal ? 100 : 50 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#141419',
      borderColor: '#2a2a38',
      textStyle: { color: '#ededf0', fontFamily: 'Berkeley Mono, monospace', fontSize: 12 },
    },
    xAxis: props.horizontal ? valueAxis : categoryAxis,
    yAxis: props.horizontal ? categoryAxis : valueAxis,
    series: props.datasets.map((ds) => ({
      name: ds.name,
      type: 'bar',
      data: ds.data,
      stack: props.stacked ? 'total' : undefined,
      barWidth: '60%',
      itemStyle: {
        color: ds.color || '#5b5ef4',
        borderRadius: props.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    })),
    animation: true,
    animationDuration: 400,
    animationEasing: 'cubicOut',
  }
})
</script>

<style scoped>
.bar-chart { width: 100%; }
</style>
