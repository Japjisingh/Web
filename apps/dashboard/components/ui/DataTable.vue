<template>
  <div class="data-table-wrapper">
    <div class="data-table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="{ width: col.width, minWidth: col.minWidth, textAlign: col.align || 'left' }"
              :class="{ 'sortable': col.sortable }"
              @click="col.sortable && toggleSort(col.key)"
            >
              <span class="data-table__th-content">
                {{ col.label }}
                <span v-if="sortKey === col.key" class="data-table__sort-icon">
                  {{ sortDir === 'asc' ? '↑' : '↓' }}
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 8" :key="i">
              <td v-for="col in columns" :key="col.key">
                <div class="skeleton" :style="{ width: '70%', height: '14px' }" />
              </td>
            </tr>
          </template>
          <template v-else-if="sortedRows.length === 0">
            <tr>
              <td :colspan="columns.length" class="data-table__empty">
                <slot name="empty">
                  <EmptyState title="No data" description="No records found matching your filters." />
                </slot>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="(row, idx) in sortedRows"
              :key="row.id || idx"
              :class="{ 'data-table__row--selected': selectedRows.has(row.id) }"
              @click="$emit('rowClick', row)"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                :style="{ textAlign: col.align || 'left' }"
                :class="col.class"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="!loading && sortedRows.length > 0" class="data-table__footer">
      <span class="text-secondary" style="font-size: 0.75rem">
        Showing {{ sortedRows.length }} of {{ total || sortedRows.length }} records
      </span>
      <slot name="footer-actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  key: string
  label: string
  width?: string
  minWidth?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  class?: string
}

const props = defineProps<{
  columns: Column[]
  rows: Record<string, unknown>[]
  loading?: boolean
  total?: number
  selectable?: boolean
}>()

defineEmits<{
  rowClick: [row: Record<string, unknown>]
}>()

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('desc')
const selectedRows = ref(new Set<string>())

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows
  return [...props.rows].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})
</script>

<style scoped>
.data-table-wrapper {
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  overflow: hidden;
}

.data-table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table th {
  background: var(--bg-elevated);
  padding: 10px 16px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-base);
  white-space: nowrap;
  user-select: none;
}

.data-table th.sortable {
  cursor: pointer;
}

.data-table th.sortable:hover {
  color: var(--text-primary);
}

.data-table__th-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.data-table__sort-icon {
  font-size: 0.625rem;
  color: var(--primary);
}

.data-table td {
  padding: 10px 16px;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--border-base);
  color: var(--text-primary);
}

.data-table tbody tr {
  transition: background var(--transition-fast);
}

.data-table tbody tr:hover {
  background: var(--bg-subtle);
}

.data-table tbody tr:nth-child(even) {
  background: rgba(31, 31, 40, 0.3);
}

.data-table tbody tr:nth-child(even):hover {
  background: var(--bg-subtle);
}

.data-table__row--selected {
  background: var(--primary-muted) !important;
}

.data-table__empty {
  text-align: center;
  padding: 48px 16px !important;
}

.data-table__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-surface);
}
</style>
