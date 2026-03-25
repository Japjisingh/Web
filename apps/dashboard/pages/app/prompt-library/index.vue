<template>
  <div class="prompts fade-slide-in">
    <div class="prompts__header">
      <div class="prompts__categories">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="prompts__cat-btn"
          :class="{ 'prompts__cat-btn--active': activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          {{ cat.label }}
        </button>
      </div>
      <button class="btn-primary" @click="showCreate = true">Create Prompt</button>
    </div>

    <div class="prompts__grid">
      <div v-for="prompt in filteredPrompts" :key="prompt.id" class="card prompts__card">
        <div class="prompts__card-top">
          <h3 class="prompts__card-name">{{ prompt.name }}</h3>
          <span class="prompts__category-badge">{{ prompt.category }}</span>
        </div>

        <p class="prompts__card-template mono">{{ prompt.template }}</p>

        <div class="prompts__card-stats">
          <span class="prompts__stat mono">{{ prompt.avgTokens }} tokens</span>
          <span class="prompts__stat mono">£{{ prompt.avgCost }}</span>
          <span class="prompts__stat mono">{{ prompt.useCount.toLocaleString() }} uses</span>
        </div>

        <div class="prompts__card-actions">
          <button class="btn-primary" style="flex: 1; height: 30px; font-size: 0.75rem">
            Use in Playground
          </button>
          <button class="btn-ghost" style="height: 30px; font-size: 0.75rem">Copy</button>
          <button class="btn-ghost" style="height: 30px; font-size: 0.75rem">Edit</button>
        </div>
      </div>
    </div>

    <SlideOver v-model="showCreate" title="Create Prompt">
      <div class="prompts__form">
        <div class="prompts__field">
          <label>Name</label>
          <input type="text" placeholder="Order Status Check" />
        </div>
        <div class="prompts__field">
          <label>Category</label>
          <select>
            <option v-for="c in categories.slice(1)" :key="c.id" :value="c.id">{{ c.label }}</option>
          </select>
        </div>
        <div class="prompts__field">
          <label>Template</label>
          <textarea rows="6" class="mono" style="font-size: 0.75rem" placeholder="Check the status of order {{orderId}} for customer {{customerName}}..." />
          <span style="font-size: 0.6875rem; color: var(--text-muted)">Use &#123;&#123;variableName&#125;&#125; for dynamic values</span>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary">Save Prompt</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const showCreate = ref(false)
const activeCategory = ref('all')

const categories = [
  { id: 'all', label: 'All' },
  { id: 'customer_service', label: 'Customer Service' },
  { id: 'product', label: 'Product' },
  { id: 'hr', label: 'HR' },
  { id: 'legal', label: 'Legal' },
  { id: 'general', label: 'General' },
]

const prompts = ref([
  {
    id: '1', name: 'Order Status Check', category: 'customer_service',
    template: 'Check the status of order {{orderId}} for customer {{customerName}}. Provide a friendly update including estimated delivery date.',
    avgTokens: 245, avgCost: '0.0005', useCount: 8934,
  },
  {
    id: '2', name: 'Product Description Generator', category: 'product',
    template: 'Write a compelling product description for {{productName}}. Category: {{category}}. Key features: {{features}}. Target audience: {{audience}}. Keep it under 200 words.',
    avgTokens: 512, avgCost: '0.0010', useCount: 3421,
  },
  {
    id: '3', name: 'Return Policy Response', category: 'customer_service',
    template: 'A customer is asking about our return policy for {{productType}}. Purchased {{daysSincePurchase}} days ago. Provide clear, empathetic guidance.',
    avgTokens: 180, avgCost: '0.0004', useCount: 5672,
  },
  {
    id: '4', name: 'SEO Meta Description', category: 'product',
    template: 'Generate an SEO-optimized meta description (max 160 chars) for: {{pageTitle}}. Primary keyword: {{keyword}}.',
    avgTokens: 95, avgCost: '0.0001', useCount: 12340,
  },
  {
    id: '5', name: 'Complaint Resolution', category: 'customer_service',
    template: 'A customer filed a complaint: "{{complaint}}". Order: {{orderId}}. Propose a resolution that is empathetic and follows our policy.',
    avgTokens: 320, avgCost: '0.0006', useCount: 2891,
  },
  {
    id: '6', name: 'Email Subject Lines', category: 'general',
    template: 'Generate 5 email subject lines for a {{campaignType}} campaign targeting {{audience}}. Tone: {{tone}}. Include urgency where appropriate.',
    avgTokens: 150, avgCost: '0.0003', useCount: 4567,
  },
])

const filteredPrompts = computed(() => {
  if (activeCategory.value === 'all') return prompts.value
  return prompts.value.filter((p) => p.category === activeCategory.value)
})
</script>

<style scoped>
.prompts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.prompts__categories {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 2px;
}

.prompts__cat-btn {
  padding: 5px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.prompts__cat-btn:hover { color: var(--text-primary); background: var(--bg-overlay); }
.prompts__cat-btn--active { color: var(--text-primary); background: var(--bg-elevated); }

.prompts__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.prompts__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompts__card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.prompts__card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.prompts__category-badge {
  font-size: 0.625rem;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.prompts__card-template {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prompts__card-stats {
  display: flex;
  gap: 16px;
}

.prompts__stat {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.prompts__card-actions {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
}

.prompts__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompts__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompts__field label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.prompts__field input,
.prompts__field textarea,
.prompts__field select {
  width: 100%;
}
</style>
