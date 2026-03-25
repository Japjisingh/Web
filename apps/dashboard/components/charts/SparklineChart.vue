<template>
  <div class="sparkline chart-enter" :style="{ height: `${height}px` }">
    <VChart :option="chartOption" :autoresize="true" />
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  data: number[]
  height?: number
  color?: string
}>(), {
  height: 40,
  color: 'var(--primary)',
})

const chartOption = computed(() => ({
  grid: { top: 0, right: 0, bottom: 0, left: 0 },
  xAxis: { type: 'category', show: false, data: props.data.map((_, i) => i) },
  yAxis: { type: 'value', show: false },
  series: [{
    type: 'line',
    data: props.data,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.5, color: '#5b5ef4' },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: '#5b5ef430' },
          { offset: 1, color: '#5b5ef405' },
        ],
      },
    },
  }],
  animation: true,
  animationDuration: 400,
  animationEasing: 'cubicOut',
}))
</script>

<style scoped>
.sparkline {
  width: 100%;
}
</style>
