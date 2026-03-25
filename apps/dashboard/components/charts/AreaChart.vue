<template>
  <div class="area-chart chart-enter" :style="{ height: `${height}px` }">
    <VChart :option="chartOption" :autoresize="true" />
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  labels: string[]
  datasets: Array<{
    name: string
    data: number[]
    color?: string
    dashed?: boolean
  }>
  height?: number
  stacked?: boolean
  showLegend?: boolean
}>(), {
  height: 300,
  stacked: false,
  showLegend: true,
})

const chartOption = computed(() => ({
  grid: { top: 30, right: 20, bottom: 30, left: 50 },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#141419',
    borderColor: '#2a2a38',
    textStyle: { color: '#ededf0', fontFamily: 'Berkeley Mono, monospace', fontSize: 12 },
    axisPointer: { type: 'cross', crossStyle: { color: '#55556a' } },
  },
  legend: props.showLegend ? {
    show: true,
    top: 0,
    right: 0,
    textStyle: { color: '#8888a0', fontSize: 11 },
    itemWidth: 12,
    itemHeight: 2,
  } : undefined,
  xAxis: {
    type: 'category',
    data: props.labels,
    axisLine: { lineStyle: { color: '#1e1e28' } },
    axisLabel: { color: '#55556a', fontSize: 10, fontFamily: 'Berkeley Mono, monospace' },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#1e1e28', opacity: 0.15 } },
    axisLabel: { color: '#55556a', fontSize: 10, fontFamily: 'Berkeley Mono, monospace' },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: props.datasets.map((ds) => ({
    name: ds.name,
    type: 'line',
    data: ds.data,
    smooth: true,
    showSymbol: false,
    stack: props.stacked ? 'total' : undefined,
    lineStyle: {
      width: 2,
      color: ds.color || '#5b5ef4',
      type: ds.dashed ? 'dashed' : 'solid',
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: (ds.color || '#5b5ef4') + '30' },
          { offset: 1, color: (ds.color || '#5b5ef4') + '05' },
        ],
      },
    },
  })),
  animation: true,
  animationDuration: 400,
  animationEasing: 'cubicOut',
}))
</script>

<style scoped>
.area-chart { width: 100%; }
</style>
