<template>
  <div class="api-keys fade-slide-in">
    <div class="api-keys__header">
      <h2 class="api-keys__count mono">{{ apiKeys.length }} keys</h2>
      <button class="btn-primary" @click="showCreate = true">Create Key</button>
    </div>

    <DataTable :columns="columns" :rows="apiKeys">
      <template #cell-prefix="{ value }">
        <span class="mono" style="font-size: 0.75rem; color: var(--text-muted)">{{ value }}</span>
      </template>
      <template #cell-vertical="{ value }">
        <span v-if="value" class="api-keys__vertical-badge">{{ value }}</span>
        <span v-else class="text-muted" style="font-size: 0.75rem">—</span>
      </template>
      <template #cell-lastUsed="{ value }">
        <span class="text-secondary" style="font-size: 0.75rem">{{ value }}</span>
      </template>
      <template #cell-requests30d="{ value }">
        <span class="mono">{{ Number(value).toLocaleString() }}</span>
      </template>
      <template #cell-cost30d="{ value }">
        <span class="mono">&pound;{{ value }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="api-keys__status" :class="`api-keys__status--${row.status}`">
          <StatusDot :color="row.status === 'active' ? 'success' : row.status === 'expired' ? 'danger' : 'neutral'" />
          {{ row.status }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="api-keys__actions">
          <button class="btn-ghost api-keys__action-btn" @click="revokeKey(row.id)">Revoke</button>
          <button class="btn-ghost api-keys__action-btn" @click="rotateKey(row.id)">Rotate</button>
        </div>
      </template>
    </DataTable>

    <!-- Create Key SlideOver -->
    <SlideOver v-model="showCreate" title="Create API Key">
      <div class="api-keys__form">
        <div class="api-keys__field">
          <label class="api-keys__field-label">Name</label>
          <input v-model="form.name" type="text" placeholder="Production Backend" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Vertical</label>
          <select v-model="form.vertical">
            <option value="">General</option>
            <option value="ecommerce">Ecommerce</option>
            <option value="hr">HR & Recruitment</option>
            <option value="healthtech">HealthTech</option>
            <option value="fintech">FinTech</option>
          </select>
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Rate Limit (req/min)</label>
          <input v-model="form.rateLimit" type="number" placeholder="1000" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Monthly Budget (&pound;)</label>
          <input v-model="form.monthlyBudget" type="number" placeholder="500" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Expiry</label>
          <select v-model="form.expiry">
            <option value="never">Never</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary" @click="createKey">Create Key</button>
      </template>
    </SlideOver>

    <!-- Key Created SlideOver -->
    <SlideOver v-model="showKeyCreated" title="API Key Created">
      <div class="api-keys__created">
        <p class="text-secondary" style="font-size: 0.8125rem; margin-bottom: 16px; line-height: 1.5">
          Your API key has been created. Copy it now — you will not be able to see it again.
        </p>
        <div class="api-keys__key-display">
          <span class="mono">{{ createdKey }}</span>
          <button class="api-keys__copy-btn" @click="copyKey">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <div class="api-keys__key-warning">
          Store this key securely. It will only be shown once.
        </div>
      </div>
      <template #footer>
        <button class="btn-primary" @click="showKeyCreated = false">Done</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const showCreate = ref(false)
const showKeyCreated = ref(false)
const createdKey = ref('')
const copied = ref(false)

const form = reactive({
  name: '',
  vertical: '',
  rateLimit: '',
  monthlyBudget: '',
  expiry: 'never',
})

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'prefix', label: 'Prefix', width: '120px' },
  { key: 'vertical', label: 'Vertical', width: '110px' },
  { key: 'lastUsed', label: 'Last Used', width: '120px', sortable: true },
  { key: 'requests30d', label: 'Requests 30d', width: '120px', align: 'right' as const, sortable: true },
  { key: 'cost30d', label: 'Cost 30d', width: '100px', align: 'right' as const, sortable: true },
  { key: 'status', label: 'Status', width: '100px' },
  { key: 'actions', label: '', width: '140px', align: 'right' as const },
]

const apiKeys = ref([
  {
    id: 'key-1',
    name: 'Production Backend',
    prefix: 'ng_live_8f2a…',
    vertical: 'ecommerce',
    lastUsed: '2 minutes ago',
    requests30d: 284729,
    cost30d: '482.30',
    status: 'active',
  },
  {
    id: 'key-2',
    name: 'Staging Environment',
    prefix: 'ng_test_c91b…',
    vertical: null,
    lastUsed: '14 hours ago',
    requests30d: 12483,
    cost30d: '18.40',
    status: 'active',
  },
  {
    id: 'key-3',
    name: 'ML Pipeline',
    prefix: 'ng_live_3d7e…',
    vertical: 'healthtech',
    lastUsed: '3 days ago',
    requests30d: 89201,
    cost30d: '156.80',
    status: 'active',
  },
  {
    id: 'key-4',
    name: 'Legacy Integration',
    prefix: 'ng_live_a02f…',
    vertical: 'hr',
    lastUsed: '28 days ago',
    requests30d: 340,
    cost30d: '1.20',
    status: 'expired',
  },
])

function createKey() {
  const prefix = `ng_live_${Math.random().toString(36).substring(2, 6)}`
  createdKey.value = `${prefix}_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`

  apiKeys.value.unshift({
    id: `key-${Date.now()}`,
    name: form.name || 'Unnamed Key',
    prefix: `${prefix}…`,
    vertical: form.vertical || null,
    lastUsed: 'Just now',
    requests30d: 0,
    cost30d: '0.00',
    status: 'active',
  })

  showCreate.value = false
  showKeyCreated.value = true
  copied.value = false

  form.name = ''
  form.vertical = ''
  form.rateLimit = ''
  form.monthlyBudget = ''
  form.expiry = 'never'
}

function copyKey() {
  navigator.clipboard.writeText(createdKey.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function revokeKey(id: string) {
  const key = apiKeys.value.find(k => k.id === id)
  if (key) key.status = 'revoked'
}

function rotateKey(id: string) {
  const key = apiKeys.value.find(k => k.id === id)
  if (key) {
    const prefix = `ng_live_${Math.random().toString(36).substring(2, 6)}`
    key.prefix = `${prefix}…`
    createdKey.value = `${prefix}_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`
    showKeyCreated.value = true
    copied.value = false
  }
}
</script>

<style scoped>
.api-keys__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.api-keys__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.api-keys__vertical-badge {
  font-size: 0.6875rem;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
}

.api-keys__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.api-keys__status--active { color: var(--success); }
.api-keys__status--expired { color: var(--danger); }
.api-keys__status--revoked { color: var(--text-muted); }

.api-keys__actions {
  display: flex;
  gap: 4px;
}

.api-keys__action-btn {
  font-size: 0.6875rem !important;
  padding: 3px 8px !important;
  height: auto !important;
}

.api-keys__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-keys__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.api-keys__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.api-keys__field input,
.api-keys__field select {
  width: 100%;
}

.api-keys__created {
  display: flex;
  flex-direction: column;
}

.api-keys__key-display {
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.api-keys__key-display .mono {
  font-size: 0.875rem;
  color: var(--primary);
  word-break: break-all;
  line-height: 1.6;
}

.api-keys__copy-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.api-keys__copy-btn:hover {
  opacity: 0.85;
}

.api-keys__key-warning {
  font-size: 0.75rem;
  color: var(--warning);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px;
  padding: 10px 12px;
}
</style>
