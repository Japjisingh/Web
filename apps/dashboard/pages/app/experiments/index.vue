<template>
  <div class="experiments fade-slide-in">
    <div class="experiments__header">
      <h2 class="experiments__count mono">{{ experiments.length }} experiments</h2>
      <button class="btn-primary" @click="showCreate = true">New Experiment</button>
    </div>

    <div class="experiments__list">
      <div v-for="exp in experiments" :key="exp.id" class="card experiments__card">
        <div class="experiments__card-header">
          <div>
            <h3 class="experiments__card-name">{{ exp.name }}</h3>
            <span
              class="experiments__status"
              :class="`experiments__status--${exp.status}`"
            >
              <StatusDot :color="exp.status === 'running' ? 'success' : exp.status === 'complete' ? 'info' : 'neutral'" :pulse="exp.status === 'running'" />
              {{ exp.status }}
            </span>
          </div>
          <div class="experiments__card-actions">
            <button v-if="exp.status === 'running'" class="btn-ghost" style="height: 30px; font-size: 0.75rem">Pause</button>
            <button class="btn-primary" style="height: 30px; font-size: 0.75rem">View Results</button>
          </div>
        </div>

        <div class="experiments__variants">
          <div class="experiments__variant" :class="{ 'experiments__variant--winning': exp.winner === 'A' }">
            <span class="experiments__variant-label mono">Variant A</span>
            <span class="experiments__variant-desc">{{ exp.variantA }}</span>
            <div class="experiments__variant-stats">
              <span class="mono">{{ exp.samplesA }} samples</span>
              <span class="mono" :style="{ color: exp.winner === 'A' ? 'var(--success)' : 'var(--text-secondary)' }">
                {{ exp.metricA }}
              </span>
            </div>
          </div>
          <div class="experiments__vs mono">VS</div>
          <div class="experiments__variant" :class="{ 'experiments__variant--winning': exp.winner === 'B' }">
            <span class="experiments__variant-label mono">Variant B</span>
            <span class="experiments__variant-desc">{{ exp.variantB }}</span>
            <div class="experiments__variant-stats">
              <span class="mono">{{ exp.samplesB }} samples</span>
              <span class="mono" :style="{ color: exp.winner === 'B' ? 'var(--success)' : 'var(--text-secondary)' }">
                {{ exp.metricB }}
              </span>
            </div>
          </div>
        </div>

        <div class="experiments__footer">
          <span class="text-secondary" style="font-size: 0.75rem">
            Traffic split: {{ exp.split }} | Metric: {{ exp.metric }}
          </span>
          <span v-if="exp.significance" class="experiments__sig mono">
            {{ exp.significance }}
          </span>
        </div>
      </div>
    </div>

    <SlideOver v-model="showCreate" title="New Experiment">
      <div class="experiments__form">
        <div class="experiments__field">
          <label>Experiment Name</label>
          <input type="text" placeholder="GPT-4o vs Claude for support" />
        </div>
        <div class="experiments__field">
          <label>Variant A</label>
          <textarea rows="3" placeholder="Model, prompt, or parameters for Variant A" />
        </div>
        <div class="experiments__field">
          <label>Variant B</label>
          <textarea rows="3" placeholder="Model, prompt, or parameters for Variant B" />
        </div>
        <div class="experiments__field">
          <label>Success Metric</label>
          <select>
            <option value="cost">Cost per request</option>
            <option value="latency">Latency</option>
            <option value="quality">Response quality score</option>
            <option value="tokens">Token efficiency</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary">Start Experiment</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const showCreate = ref(false)

const experiments = ref([
  {
    id: '1', name: 'GPT-4o vs GPT-4o-mini for FAQ', status: 'running',
    variantA: 'GPT-4o — full model', variantB: 'GPT-4o-mini — optimised prompt',
    samplesA: '847', samplesB: '852', split: '50/50',
    metric: 'Cost', metricA: '£0.0038/req', metricB: '£0.0002/req',
    winner: 'B', significance: 'Variant B is 95% cheaper — statistically significant (p<0.01)',
  },
  {
    id: '2', name: 'System Prompt A/B for Descriptions', status: 'running',
    variantA: 'Detailed instructions prompt', variantB: 'Concise few-shot prompt',
    samplesA: '423', samplesB: '419', split: '50/50',
    metric: 'Quality', metricA: '4.2/5', metricB: '4.1/5',
    winner: null, significance: 'Not yet significant — need 577 more samples',
  },
  {
    id: '3', name: 'Claude vs GPT for Translations', status: 'complete',
    variantA: 'Claude Sonnet 4', variantB: 'GPT-4o',
    samplesA: '1,024', samplesB: '1,031', split: '50/50',
    metric: 'Latency', metricA: '520ms avg', metricB: '340ms avg',
    winner: 'B', significance: 'GPT-4o is 34.6% faster — experiment concluded',
  },
])
</script>

<style scoped>
.experiments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.experiments__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.experiments__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.experiments__card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.experiments__card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.experiments__card-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.experiments__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.experiments__status--running { color: var(--success); }
.experiments__status--complete { color: var(--info); }
.experiments__status--paused { color: var(--text-muted); }

.experiments__card-actions { display: flex; gap: 6px; }

.experiments__variants {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.experiments__variant {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.experiments__variant--winning {
  border-color: var(--success);
  background: var(--success-muted);
}

.experiments__variant-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.experiments__variant-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.experiments__variant-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.experiments__vs {
  display: flex;
  align-items: center;
  font-size: 0.625rem;
  color: var(--text-muted);
  font-weight: 700;
}

.experiments__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
}

.experiments__sig {
  font-size: 0.6875rem;
  color: var(--success);
}

.experiments__form { display: flex; flex-direction: column; gap: 16px; }
.experiments__field { display: flex; flex-direction: column; gap: 6px; }
.experiments__field label {
  font-size: 0.6875rem; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.experiments__field input,
.experiments__field textarea,
.experiments__field select { width: 100%; }
</style>
