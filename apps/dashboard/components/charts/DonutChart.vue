<template>
  <div class="donut-chart chart-enter" :style="{ height: `${height}px` }">
    <VChart :option="chartOption" :autoresize="true" />
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  data: Array<{ name: string; value: number; color?: string }>
  height?: number
  centerText?: string
}>(), {
  height: 250,
})

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: '#141419',
    borderColor: '#2a2a38',
    textStyle: { color: '#ededf0', fontFamily: 'Berkeley Mono, monospace', fontSize: 12 },
    formatter: (params: { name: string; value: number; percent: number }) =>
      `${params.name}<br/><span style="font-family: Berkeley Mono">${params.value.toLocaleString()} (${params.percent}%)</span>`,
  },
  series: [{
    type: 'pie',
    radius: ['55%', '78%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    itemStyle: { borderColor: '#0d0d12', borderWidth: 2 },
    label: { show: false },
    emphasis: {
      label: { show: false },
      itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.3)' },
    },
    data: props.data.map((d, i) => ({
      ...d,
      itemStyle: d.color ? { color: d.color } : undefined,
    })),
  }],
  color: ['#5b5ef4', '#3b82f6', '#f59e0b', '#f97316', '#06b6d4', '#00d97e', '#a855f7', '#ff4757'],
  graphic: props.centerText ? [{
    type: 'text',
    left: 'center',
    top: 'center',
    style: {
      text: props.centerText,
      fill: '#8888a0',
      fontSize: 13,
      fontFamily: 'Geist, sans-serif',
    },
  }] : [],
  animation: true,
  animationDuration: 400,
  animationEasing: 'cubicOut',
}))
</script>

<style scoped>
.donut-chart { width: 100%; }
</style>
