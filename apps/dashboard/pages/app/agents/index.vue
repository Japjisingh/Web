<template>
  <div class="agents fade-slide-in">
    <div class="agents__header">
      <h2 class="agents__count mono">{{ agents.length }} agents</h2>
      <button class="btn-primary" @click="showCreate = true">Create Agent</button>
    </div>

    <div class="agents__grid">
      <div v-for="agent in agents" :key="agent.id" class="card agents__card">
        <div class="agents__card-header">
          <div>
            <h3 class="agents__card-name">{{ agent.name }}</h3>
            <p class="agents__card-desc">{{ agent.description }}</p>
          </div>
          <span
            class="agents__status-badge"
            :class="agent.isActive ? 'agents__status-badge--active' : 'agents__status-badge--paused'"
          >
            <StatusDot :color="agent.isActive ? 'success' : 'neutral'" />
            {{ agent.isActive ? 'Active' : 'Paused' }}
          </span>
        </div>

        <div class="agents__card-meta">
          <ModelBadge :model="agent.model" />
          <span v-if="agent.vertical" class="agents__vertical-badge">{{ agent.vertical }}</span>
        </div>

        <div class="agents__card-stats">
          <div class="agents__stat">
            <span class="agents__stat-label">Calls (30d)</span>
            <span class="agents__stat-value mono">{{ agent.totalCalls.toLocaleString() }}</span>
          </div>
          <div class="agents__stat">
            <span class="agents__stat-label">Avg Cost</span>
            <span class="agents__stat-value mono">£{{ agent.avgCost }}</span>
          </div>
          <div class="agents__stat">
            <span class="agents__stat-label">Temperature</span>
            <span class="agents__stat-value mono">{{ agent.temperature }}</span>
          </div>
        </div>

        <div class="agents__card-actions">
          <button class="btn-primary" style="flex: 1; height: 32px; font-size: 0.75rem">Run</button>
          <button class="btn-ghost" style="flex: 1; height: 32px; font-size: 0.75rem">Edit</button>
          <button class="btn-ghost" style="flex: 1; height: 32px; font-size: 0.75rem">Logs</button>
        </div>
      </div>
    </div>

    <SlideOver v-model="showCreate" title="Create Agent">
      <div class="agents__create-form">
        <div class="agents__field">
          <label class="agents__field-label">Name</label>
          <input type="text" placeholder="Customer Support Agent" />
        </div>
        <div class="agents__field">
          <label class="agents__field-label">Description</label>
          <textarea rows="2" placeholder="What does this agent do?" />
        </div>
        <div class="agents__field">
          <label class="agents__field-label">Vertical</label>
          <select>
            <option value="">General</option>
            <option value="ecommerce">Ecommerce</option>
            <option value="hr">HR & Recruitment</option>
            <option value="healthtech">HealthTech</option>
          </select>
        </div>
        <div class="agents__field">
          <label class="agents__field-label">System Prompt</label>
          <textarea rows="5" class="mono" placeholder="You are a helpful..." style="font-size: 0.75rem" />
        </div>
        <div class="agents__field">
          <label class="agents__field-label">Model</label>
          <select>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="claude-sonnet">Claude Sonnet 4</option>
          </select>
        </div>
        <div class="agents__field">
          <label class="agents__field-label">Tools</label>
          <div style="display: flex; gap: 8px">
            <button class="playground__toggle">web_search</button>
            <button class="playground__toggle">code_execution</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary">Create Agent</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const showCreate = ref(false)

const agents = ref([
  {
    id: '1',
    name: 'Customer Support Agent',
    description: 'Handles common customer inquiries about orders, shipping, and returns',
    model: 'gpt-4o-mini',
    vertical: 'ecommerce',
    isActive: true,
    totalCalls: 12847,
    avgCost: '0.0004',
    temperature: '0.3',
  },
  {
    id: '2',
    name: 'Product Description Writer',
    description: 'Generates compelling product descriptions from specifications',
    model: 'gpt-4o',
    vertical: 'ecommerce',
    isActive: true,
    totalCalls: 3421,
    avgCost: '0.0089',
    temperature: '0.7',
  },
  {
    id: '3',
    name: 'Review Sentiment Analyzer',
    description: 'Classifies customer reviews by sentiment and extracts key topics',
    model: 'gpt-4o-mini',
    vertical: 'ecommerce',
    isActive: false,
    totalCalls: 8920,
    avgCost: '0.0002',
    temperature: '0.1',
  },
  {
    id: '4',
    name: 'Translation Assistant',
    description: 'Translates product content across 12 languages',
    model: 'claude-sonnet',
    vertical: null,
    isActive: true,
    totalCalls: 5634,
    avgCost: '0.0045',
    temperature: '0.2',
  },
])
</script>

<style scoped>
.agents__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.agents__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.agents__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.agents__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agents__card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.agents__card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.agents__card-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.agents__status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 9999px;
  white-space: nowrap;
  height: fit-content;
}

.agents__status-badge--active {
  color: var(--success);
  background: var(--success-muted);
}

.agents__status-badge--paused {
  color: var(--text-muted);
  background: var(--bg-elevated);
}

.agents__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agents__vertical-badge {
  font-size: 0.6875rem;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
}

.agents__card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.agents__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agents__stat-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.agents__stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.agents__card-actions {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
}

.agents__create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agents__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agents__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.agents__field input,
.agents__field textarea,
.agents__field select {
  width: 100%;
}
</style>
