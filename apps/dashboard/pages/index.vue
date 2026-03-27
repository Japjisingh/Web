<template>
  <div class="landing">
    <!-- Navbar -->
    <nav class="landing-nav" :class="{ 'landing-nav--scrolled': scrolled }">
      <div class="landing-nav__inner">
        <div class="landing-nav__left">
          <span class="landing-nav__logo mono">NeuralGate</span>
          <StatusDot color="success" :pulse="true" />
        </div>
        <div class="landing-nav__links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div class="landing-nav__right">
          <NuxtLink to="/auth/login" class="btn-ghost">Sign in</NuxtLink>
          <NuxtLink to="/auth/register" class="btn-primary">Start free</NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__grid-bg" />
      <div class="hero__glow" />

      <div class="hero__content">
        <span class="hero__badge">Now in public beta — join 500+ teams</span>
        <h1 class="hero__headline mono">
          Your AI spend is<br />
          <span class="hero__headline--accent">out of control.</span>
        </h1>
        <p class="hero__sub">
          NeuralGate sits between your app and OpenAI.<br />
          Track every token. Cache every repeat. Route to<br />
          cheaper models automatically. One line of code.
        </p>
        <div class="hero__ctas">
          <NuxtLink to="/auth/register" class="btn-primary hero__cta-primary">
            Start free — no credit card
          </NuxtLink>
          <a href="#features" class="btn-ghost hero__cta-ghost">View live demo →</a>
        </div>
        <p class="hero__proof">
          Average customer saves <span class="text-success mono">43%</span> on AI costs in first week
        </p>
      </div>

      <!-- Hero demo animation -->
      <div class="hero__demo">
        <div class="hero__demo-card card">
          <div class="hero__demo-header">
            <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">LIVE REQUESTS</span>
            <StatusDot color="success" :pulse="true" />
          </div>
          <div class="hero__demo-rows">
            <div v-for="row in demoRows" :key="row.id" class="hero__demo-row" :class="{ 'row-flash': row.isCache }">
              <ModelBadge :model="row.model" :cached="row.isCache" />
              <span class="mono" style="font-size: 0.6875rem; color: var(--text-secondary)">{{ row.endpoint }}</span>
              <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">{{ row.tokens }}</span>
              <span class="mono" style="font-size: 0.6875rem">{{ row.cost }}</span>
              <span v-if="row.isCache" class="hero__saved-tag mono">SAVED {{ row.cost }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Logos bar -->
    <section class="logos-bar">
      <p class="logos-bar__text">Trusted by teams at</p>
      <div class="logos-bar__grid">
        <div v-for="i in 6" :key="i" class="logos-bar__logo skeleton" style="width: 100px; height: 24px; opacity: 0.3" />
      </div>
    </section>

    <!-- Problem section -->
    <section class="problem">
      <h2 class="section-title">The AI bill no one warned you about</h2>
      <div class="problem__grid">
        <div class="card problem__card">
          <div class="problem__icon">📊</div>
          <h3 class="problem__card-title">Zero visibility</h3>
          <p class="problem__card-desc">You see one number from OpenAI. You don't know which feature, which user, which endpoint is responsible.</p>
        </div>
        <div class="card problem__card">
          <div class="problem__icon">💸</div>
          <h3 class="problem__card-title">Paying for duplicates</h3>
          <p class="problem__card-desc">34% of AI calls are identical requests you've already paid for. You just don't know it.</p>
        </div>
        <div class="card problem__card">
          <div class="problem__icon">🔀</div>
          <h3 class="problem__card-title">Wrong model for the job</h3>
          <p class="problem__card-desc">Using GPT-4o to answer 'What's your return policy?' costs 20x more than it should.</p>
        </div>
      </div>
    </section>

    <!-- Solution section -->
    <section class="solution">
      <h2 class="section-title">One line of code. Full control.</h2>
      <div class="solution__comparison">
        <div class="solution__before">
          <span class="solution__label text-muted">BEFORE</span>
          <CodeBlock :code="codeBefore" language="javascript" />
        </div>
        <div class="solution__after">
          <span class="solution__label" style="color: var(--success)">AFTER</span>
          <CodeBlock :code="codeAfter" language="javascript" />
        </div>
      </div>
      <p class="solution__tagline">That's it. Everything else is automatic.</p>
    </section>

    <!-- Savings Calculator -->
    <section id="features" class="calculator">
      <h2 class="section-title">How much could you save?</h2>
      <div class="calculator__card card">
        <div class="calculator__input">
          <label class="calculator__label">Monthly AI spend</label>
          <div class="calculator__slider-row">
            <input type="range" v-model.number="monthlySpend" min="500" max="50000" step="500" class="calculator__slider" />
            <span class="mono calculator__spend-value">£{{ monthlySpend.toLocaleString() }}</span>
          </div>
        </div>
        <div class="calculator__results">
          <div class="calculator__result">
            <span class="calculator__result-label">Estimated monthly saving</span>
            <span class="calculator__result-value mono text-success">£{{ estimatedSaving.toLocaleString() }}</span>
          </div>
          <div class="calculator__breakdown">
            <div class="calculator__breakdown-row">
              <span>Cache savings</span>
              <span class="mono">£{{ cacheSaving.toLocaleString() }}</span>
            </div>
            <div class="calculator__breakdown-row">
              <span>Routing savings</span>
              <span class="mono">£{{ routingSaving.toLocaleString() }}</span>
            </div>
          </div>
          <NuxtLink to="/auth/register" class="btn-primary" style="width: 100%; height: 44px; display: flex; align-items: center; justify-content: center; text-decoration: none">
            Start saving now →
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features Bento Grid -->
    <section class="bento">
      <h2 class="section-title">Everything you need to control AI costs</h2>
      <div class="bento__grid">
        <div class="card bento__card bento__card--large">
          <span class="bento__card-label">COST ANALYTICS</span>
          <h3 class="bento__card-title">See exactly where every penny goes</h3>
          <p class="bento__card-desc">Real-time cost breakdowns by model, endpoint, and team. Never get surprised by your AI bill again.</p>
          <div class="bento__card-demo">
            <div class="bento__mini-chart">
              <div v-for="(h, i) in [60, 45, 72, 38, 55, 42, 68]" :key="i" class="bento__bar" :style="{ height: `${h}%`, animationDelay: `${i * 80}ms` }" />
            </div>
          </div>
        </div>
        <div class="card bento__card bento__card--medium">
          <span class="bento__card-label">SEMANTIC CACHING</span>
          <h3 class="bento__card-title">Stop paying for the same answer twice</h3>
          <p class="bento__card-desc">AI-powered similarity matching caches semantically equivalent queries. 34% average cache hit rate.</p>
          <div class="bento__cache-demo">
            <div class="bento__cache-pill bento__cache-pill--hit">CACHE HIT <span class="mono">£0.00</span></div>
            <div class="bento__cache-pill bento__cache-pill--miss">MISS <span class="mono">£0.0038</span></div>
            <div class="bento__cache-pill bento__cache-pill--hit">CACHE HIT <span class="mono">£0.00</span></div>
          </div>
        </div>
        <div class="card bento__card bento__card--medium">
          <span class="bento__card-label">SMART ROUTING</span>
          <h3 class="bento__card-title">Right model for every request</h3>
          <p class="bento__card-desc">Automatically route simple queries to cheaper models. Complex tasks go to GPT-4o. You save 20x.</p>
          <div class="bento__routing-demo">
            <div class="bento__route-line">
              <span class="text-muted">Simple →</span>
              <ModelBadge model="gpt-4o-mini" />
              <span class="mono text-success">£0.0002</span>
            </div>
            <div class="bento__route-line">
              <span class="text-muted">Complex →</span>
              <ModelBadge model="gpt-4o" />
              <span class="mono">£0.0038</span>
            </div>
          </div>
        </div>
        <div class="card bento__card bento__card--small">
          <span class="bento__card-label">PII DETECTION</span>
          <h3 class="bento__card-title">Auto-redact sensitive data</h3>
          <div class="bento__pii-demo">
            <span class="bento__pii-text">Email: <span class="bento__pii-redacted">████████</span></span>
            <span class="bento__pii-text">SSN: <span class="bento__pii-redacted">███-██-████</span></span>
          </div>
        </div>
        <div class="card bento__card bento__card--small">
          <span class="bento__card-label">BUDGET ALERTS</span>
          <h3 class="bento__card-title">Never blow your budget</h3>
          <div class="bento__alert-demo">
            <div class="bento__alert-notification">
              <span class="bento__alert-dot" />
              <span>Budget 80% reached</span>
            </div>
          </div>
        </div>
        <div class="card bento__card bento__card--large">
          <span class="bento__card-label">A/B EXPERIMENTS</span>
          <h3 class="bento__card-title">Test prompts and models with statistical rigour</h3>
          <p class="bento__card-desc">Split traffic between variants, measure quality and cost, and automatically apply the winner.</p>
          <div class="bento__experiment-demo">
            <div class="bento__variant">
              <span class="mono" style="font-size: 0.625rem; color: var(--text-muted)">VARIANT A</span>
              <span class="mono">GPT-4o — £0.0038/req</span>
            </div>
            <span class="mono text-muted" style="font-size: 0.625rem">VS</span>
            <div class="bento__variant bento__variant--winning">
              <span class="mono" style="font-size: 0.625rem; color: var(--success)">VARIANT B — WINNER</span>
              <span class="mono">GPT-4o-mini — £0.0002/req</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Vertical tabs -->
    <section class="verticals-section">
      <h2 class="section-title">Built for your industry</h2>
      <div class="verticals__tabs">
        <button
          v-for="v in verticalTabs"
          :key="v.id"
          class="verticals__tab"
          :class="{ 'verticals__tab--active': activeVertical === v.id }"
          @click="activeVertical = v.id"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="verticals__content card">
        <div class="verticals__panel" v-for="v in verticalTabs" :key="v.id" v-show="activeVertical === v.id">
          <div class="verticals__panel-left">
            <h3 class="verticals__panel-title">{{ v.title }}</h3>
            <p class="verticals__panel-desc">{{ v.description }}</p>
            <ul class="verticals__features">
              <li v-for="f in v.features" :key="f">{{ f }}</li>
            </ul>
            <span v-if="v.compliance" class="verticals__compliance-badge mono">{{ v.compliance }}</span>
          </div>
          <div class="verticals__panel-right">
            <blockquote class="verticals__quote">
              <p>"{{ v.quote.text }}"</p>
              <footer>
                <strong>{{ v.quote.name }}</strong>
                <span class="text-muted">{{ v.quote.role }}</span>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="testimonials">
      <h2 class="section-title">Loved by engineering teams</h2>
      <div class="testimonials__grid">
        <div v-for="t in testimonials" :key="t.name" class="card testimonials__card">
          <p class="testimonials__text">"{{ t.text }}"</p>
          <div class="testimonials__author">
            <div class="testimonials__avatar">{{ t.name[0] }}</div>
            <div>
              <strong class="testimonials__name">{{ t.name }}</strong>
              <span class="testimonials__role">{{ t.role }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="pricing">
      <h2 class="section-title">Simple, transparent pricing</h2>
      <div class="pricing__toggle">
        <button :class="{ active: !annual }" @click="annual = false">Monthly</button>
        <button :class="{ active: annual }" @click="annual = true">Annual (20% off)</button>
      </div>

      <div class="pricing__grid">
        <div class="card pricing__plan">
          <h3 class="pricing__plan-name">Free</h3>
          <div class="pricing__price mono">£0<span>/month</span></div>
          <ul class="pricing__features">
            <li>100k tokens tracked</li>
            <li>1 API key</li>
            <li>7-day data retention</li>
            <li>Basic dashboard</li>
          </ul>
          <NuxtLink to="/auth/register" class="btn-ghost pricing__cta">Start free</NuxtLink>
        </div>

        <div class="card pricing__plan pricing__plan--popular">
          <span class="pricing__popular-badge mono">Most Popular</span>
          <h3 class="pricing__plan-name">Starter</h3>
          <div class="pricing__price mono">£{{ annual ? 39 : 49 }}<span>/month</span></div>
          <ul class="pricing__features">
            <li>10M tokens</li>
            <li>5 API keys</li>
            <li>90-day retention</li>
            <li>Caching</li>
            <li>Model routing</li>
            <li>Email alerts</li>
          </ul>
          <NuxtLink to="/auth/register" class="btn-primary pricing__cta">Start trial</NuxtLink>
        </div>

        <div class="card pricing__plan">
          <h3 class="pricing__plan-name">Growth</h3>
          <div class="pricing__price mono">£{{ annual ? 159 : 199 }}<span>/month</span></div>
          <ul class="pricing__features">
            <li>100M tokens</li>
            <li>Unlimited keys</li>
            <li>1yr retention</li>
            <li>Semantic caching</li>
            <li>A/B experiments</li>
            <li>Playground + Agents</li>
            <li>Priority support</li>
          </ul>
          <NuxtLink to="/auth/register" class="btn-primary pricing__cta">Start trial</NuxtLink>
        </div>

        <div class="card pricing__plan">
          <h3 class="pricing__plan-name">Enterprise</h3>
          <div class="pricing__price mono">Custom</div>
          <ul class="pricing__features">
            <li>Unlimited everything</li>
            <li>Self-hosted option</li>
            <li>Custom verticals</li>
            <li>SLA guarantee</li>
            <li>Dedicated support</li>
          </ul>
          <button class="btn-ghost pricing__cta">Talk to us</button>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="faq">
      <h2 class="section-title">Frequently asked questions</h2>
      <div class="faq__list">
        <div v-for="(item, idx) in faqItems" :key="idx" class="faq__item" @click="toggleFaq(idx)">
          <div class="faq__question">
            <span>{{ item.q }}</span>
            <span class="faq__chevron" :class="{ 'faq__chevron--open': openFaq === idx }">+</span>
          </div>
          <div v-if="openFaq === idx" class="faq__answer fade-slide-in">
            {{ item.a }}
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="final-cta">
      <h2 class="final-cta__title">Start saving on AI costs today</h2>
      <p class="final-cta__sub">Free forever. No credit card. Setup in 5 minutes.</p>
      <NuxtLink to="/auth/register" class="btn-primary hero__cta-primary">Get started free</NuxtLink>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__brand">
          <span class="mono" style="font-weight: 700">NeuralGate</span>
          <p class="text-muted" style="font-size: 0.75rem; margin-top: 4px">AI Gateway & Cost Optimisation</p>
        </div>
        <div class="footer__links">
          <div class="footer__col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#">Docs</a>
            <a href="#">Changelog</a>
          </div>
          <div class="footer__col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
          </div>
          <div class="footer__col">
            <h4>Legal</h4>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
          </div>
        </div>
      </div>
      <div class="footer__bottom">
        <span class="text-muted" style="font-size: 0.6875rem">© 2026 NeuralGate. All rights reserved.</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

const scrolled = ref(false)
const monthlySpend = ref(5000)
const annual = ref(false)
const openFaq = ref<number | null>(null)

const estimatedSaving = computed(() => Math.round(monthlySpend.value * 0.43))
const cacheSaving = computed(() => Math.round(monthlySpend.value * 0.22))
const routingSaving = computed(() => Math.round(monthlySpend.value * 0.21))

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener('scroll', () => {
      scrolled.value = window.scrollY > 20
    })
  })
}

const activeVertical = ref('ecommerce')

const verticalTabs = [
  {
    id: 'ecommerce', label: 'Ecommerce',
    title: 'AI-powered shopping, optimised',
    description: 'Ecommerce teams use AI for product descriptions, customer support, and recommendations. NeuralGate ensures you\'re not overpaying for repetitive queries.',
    features: ['Cache FAQ responses automatically', 'Route simple queries to cheaper models', 'Track cost per product category', 'PII detection for customer data'],
    compliance: null,
    quote: { text: 'We cut our AI bill by 52% in the first month. The caching alone saved us thousands on repeat customer queries.', name: 'Sarah Chen', role: 'VP Engineering, ShopFlow' },
  },
  {
    id: 'hr', label: 'HR & Recruitment',
    title: 'Smarter hiring, lower costs',
    description: 'HR platforms process thousands of CVs and generate personalised outreach. NeuralGate optimises every step.',
    features: ['Batch CV screening at 10x lower cost', 'Cache common job description templates', 'PII stripping for compliance', 'Model routing for different tasks'],
    compliance: 'GDPR-ready',
    quote: { text: 'Processing 50K CVs per month used to cost us a fortune. NeuralGate\'s batch endpoint changed everything.', name: 'Marcus Webb', role: 'CTO, TalentStack' },
  },
  {
    id: 'healthtech', label: 'HealthTech',
    title: 'Compliant AI for healthcare',
    description: 'Healthcare AI needs to be cost-effective AND compliant. NeuralGate gives you both with built-in PII detection and data controls.',
    features: ['Automatic PHI detection and stripping', 'Configurable data retention policies', 'Audit trail for every AI request', 'On-premise deployment option'],
    compliance: 'HIPAA-ready',
    quote: { text: 'The PII detection caught sensitive patient data we didn\'t even know was being sent to the API.', name: 'Dr. Priya Patel', role: 'Chief Medical Officer, MedAssist AI' },
  },
  {
    id: 'legaltech', label: 'LegalTech',
    title: 'AI for legal, with guardrails',
    description: 'Legal teams need precise, auditable AI. NeuralGate provides full request logging and cost controls for legal AI workflows.',
    features: ['Full audit log of every AI interaction', 'Prompt compression for long documents', 'Cost tracking per matter/client', 'Data residency controls'],
    compliance: 'SOC 2 Type II',
    quote: { text: 'Being able to track AI costs per client matter was a game-changer for our billing.', name: 'James Liu', role: 'Head of Engineering, LexAI' },
  },
  {
    id: 'fintech', label: 'FinTech',
    title: 'Financial AI, under control',
    description: 'Financial services demand reliability and cost predictability. NeuralGate provides both with smart routing and budget controls.',
    features: ['Hard budget caps per API key', 'Real-time cost alerting', 'Model failover for high availability', 'Compliance-ready logging'],
    compliance: 'PCI DSS compatible',
    quote: { text: 'The budget alerts saved us from a runaway cost incident that could have been £10K overnight.', name: 'Alex Rivera', role: 'Engineering Lead, PaymentAI' },
  },
]

const testimonials = [
  {
    name: 'Elena Vasquez',
    role: 'Head of AI, CloudRetail',
    text: 'NeuralGate paid for itself in the first 48 hours. We were paying for the same FAQ answers thousands of times without realising it.',
  },
  {
    name: 'David Kim',
    role: 'CTO, Nexus Health',
    text: 'The smart routing alone saves us £2K/month. Simple queries go to mini, complex ones to GPT-4o. No code changes needed.',
  },
  {
    name: 'Amara Osei',
    role: 'VP Engineering, LegalEdge',
    text: 'Finally, an AI gateway that treats cost optimisation as a first-class feature, not an afterthought. The dashboard is gorgeous too.',
  },
]

const demoRows = [
  { id: 1, model: 'gpt-4o', endpoint: '/api/chat', tokens: '512→1024', cost: '£0.0038', isCache: false },
  { id: 2, model: 'gpt-4o-mini', endpoint: '/api/faq', tokens: '128→256', cost: '£0.0002', isCache: true },
  { id: 3, model: 'claude-sonnet', endpoint: '/api/gen', tokens: '1024→2048', cost: '£0.0120', isCache: false },
  { id: 4, model: 'gpt-4o-mini', endpoint: '/api/classify', tokens: '64→32', cost: '£0.0001', isCache: true },
  { id: 5, model: 'gpt-4o', endpoint: '/api/sum', tokens: '2048→512', cost: '£0.0058', isCache: false },
]

const codeBefore = `const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
})`

const codeAfter = `const openai = new OpenAI({
  apiKey: 'ng_live_xxxx',
  baseURL: 'https://gateway.neuralgate.io/v1'
})`

const faqItems = [
  { q: 'Will this add latency?', a: 'Minimal. Our gateway adds ~5-15ms of overhead. Cache hits actually reduce latency significantly since we serve from Redis instead of hitting the provider.' },
  { q: 'What if NeuralGate goes down?', a: 'We have automatic failover. If our gateway is unreachable, your SDK will fall back to direct provider calls. Zero downtime for your users.' },
  { q: 'How is my API key data secured?', a: 'All provider API keys are encrypted at rest with AES-256. We never log request/response bodies by default. SOC 2 Type II compliance in progress.' },
  { q: 'Can I use my existing OpenAI code?', a: 'Yes! Just change two lines: your API key and base URL. NeuralGate is fully compatible with the OpenAI SDK format.' },
  { q: 'What models are supported?', a: 'OpenAI (GPT-4o, GPT-4o-mini, etc.), Anthropic (Claude), Google (Gemini), Mistral, and more. We add new models within 24 hours of release.' },
  { q: 'Is there a self-hosted option?', a: 'Yes, on the Enterprise plan. We provide Docker images and Helm charts for deployment in your own infrastructure.' },
  { q: 'How does semantic caching work?', a: 'We use embedding-based similarity matching. If a new query is semantically similar to a cached one (above your threshold), we return the cached response instead of calling the provider.' },
  { q: "What's the difference from LangSmith/Helicone?", a: 'NeuralGate goes beyond observability. We actively optimise: semantic caching, smart model routing, prompt compression, and A/B testing. We don\'t just show you the costs — we reduce them.' },
]

function toggleFaq(idx: number) {
  openFaq.value = openFaq.value === idx ? null : idx
}
</script>

<style scoped>
.landing { overflow-x: hidden; }

/* Nav */
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: all 200ms ease;
}

.landing-nav--scrolled {
  background: rgba(5, 5, 7, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-base);
}

.landing-nav__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.landing-nav__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.landing-nav__logo {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.landing-nav__links {
  display: flex;
  gap: 24px;
}

.landing-nav__links a {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.landing-nav__links a:hover { color: var(--text-primary); }

.landing-nav__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Hero */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 24px 80px;
  overflow: hidden;
}

.hero__grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(91, 94, 244, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 94, 244, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: gridFade 8s ease-in-out infinite;
}

.hero__glow {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(91, 94, 244, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero__content {
  position: relative;
  text-align: center;
  max-width: 700px;
  z-index: 1;
}

.hero__badge {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 9999px;
  padding: 6px 16px;
  margin-bottom: 32px;
}

.hero__headline {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.hero__headline--accent {
  color: var(--primary);
}

.hero__sub {
  font-size: 1.125rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 32px;
}

.hero__ctas {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.hero__cta-primary {
  height: 48px;
  padding: 0 28px;
  font-size: 0.9375rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.hero__cta-ghost {
  height: 48px;
  padding: 0 28px;
  font-size: 0.9375rem;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.hero__proof {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.hero__demo {
  position: relative;
  z-index: 1;
  margin-top: 48px;
  width: 100%;
  max-width: 600px;
}

.hero__demo-card {
  padding: 12px !important;
}

.hero__demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.hero__demo-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero__demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
}

.hero__saved-tag {
  font-size: 0.5625rem;
  color: var(--success);
  background: var(--success-muted);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: auto;
}

/* Logos */
.logos-bar {
  text-align: center;
  padding: 48px 24px;
  border-top: 1px solid var(--border-base);
  border-bottom: 1px solid var(--border-base);
}

.logos-bar__text {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.logos-bar__grid {
  display: flex;
  justify-content: center;
  gap: 48px;
}

/* Section title */
.section-title {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 40px;
  color: var(--text-primary);
}

/* Problem */
.problem {
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 24px;
}

.problem__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.problem__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.problem__icon {
  font-size: 1.5rem;
}

.problem__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.problem__card-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Solution */
.solution {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px 80px;
  text-align: center;
}

.solution__comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.solution__label {
  display: block;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.solution__tagline {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* Calculator */
.calculator {
  max-width: 600px;
  margin: 0 auto;
  padding: 80px 24px;
}

.calculator__card {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.calculator__label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 8px;
}

.calculator__slider-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.calculator__slider {
  flex: 1;
  accent-color: var(--primary);
}

.calculator__spend-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 80px;
  text-align: right;
}

.calculator__result {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.calculator__result-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.calculator__result-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.calculator__breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calculator__breakdown-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* Pricing */
.pricing {
  max-width: 1100px;
  margin: 0 auto;
  padding: 80px 24px;
}

.pricing__toggle {
  display: flex;
  justify-content: center;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 2px;
  width: fit-content;
  margin: 0 auto 40px;
}

.pricing__toggle button {
  padding: 6px 16px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.pricing__toggle button.active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.pricing__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.pricing__plan {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.pricing__plan--popular {
  border-color: var(--primary);
}

.pricing__popular-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.625rem;
  font-weight: 700;
  color: white;
  background: var(--primary);
  padding: 2px 10px;
  border-radius: 9999px;
}

.pricing__plan-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.pricing__price {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.pricing__price span {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 400;
}

.pricing__features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.pricing__features li {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  padding-left: 16px;
  position: relative;
}

.pricing__features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--success);
  font-size: 0.6875rem;
}

.pricing__cta {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 600;
}

/* FAQ */
.faq {
  max-width: 700px;
  margin: 0 auto;
  padding: 80px 24px;
}

.faq__list {
  display: flex;
  flex-direction: column;
}

.faq__item {
  border-bottom: 1px solid var(--border-base);
  cursor: pointer;
}

.faq__question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
}

.faq__chevron {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
  font-size: 1.25rem;
}

.faq__chevron--open {
  transform: rotate(45deg);
}

.faq__answer {
  padding-bottom: 16px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Final CTA */
.final-cta {
  text-align: center;
  padding: 80px 24px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-base);
}

.final-cta__title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.final-cta__sub {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* Footer */
.footer {
  border-top: 1px solid var(--border-base);
  padding: 48px 24px 24px;
}

.footer__inner {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
}

.footer__links {
  display: flex;
  gap: 64px;
}

.footer__col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer__col h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.footer__col a {
  font-size: 0.8125rem;
  color: var(--text-muted);
  text-decoration: none;
}

.footer__col a:hover { color: var(--text-secondary); }

.footer__bottom {
  max-width: 1000px;
  margin: 32px auto 0;
  padding-top: 16px;
  border-top: 1px solid var(--border-base);
}

/* Bento Grid */
.bento {
  max-width: 1100px;
  margin: 0 auto;
  padding: 80px 24px;
}

.bento__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.bento__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.bento__card--large { grid-column: span 2; }
.bento__card--medium { grid-column: span 1; }
.bento__card--small { grid-column: span 1; }

.bento__card-label {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.1em;
}

.bento__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.bento__card-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.bento__mini-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 80px;
  margin-top: 12px;
}

.bento__bar {
  flex: 1;
  background: var(--primary);
  border-radius: 3px 3px 0 0;
  opacity: 0.7;
  animation: progressFill 600ms ease-out both;
}

.bento__cache-demo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.bento__cache-pill {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.bento__cache-pill--hit {
  background: var(--success-muted);
  color: var(--success);
}

.bento__cache-pill--miss {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.bento__routing-demo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.bento__route-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.bento__pii-demo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.bento__pii-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.bento__pii-redacted {
  color: var(--danger);
  background: var(--danger-muted);
  padding: 0 4px;
  border-radius: 2px;
}

.bento__alert-demo {
  margin-top: 8px;
}

.bento__alert-notification {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--warning-muted);
  border: 1px solid var(--warning);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--warning);
}

.bento__alert-dot {
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.bento__experiment-demo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.bento__variant {
  flex: 1;
  padding: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
}

.bento__variant--winning {
  border-color: var(--success);
  background: var(--success-muted);
}

/* Vertical tabs */
.verticals-section {
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 24px;
}

.verticals__tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px 8px 0 0;
  padding: 4px;
}

.verticals__tab {
  flex: 1;
  padding: 8px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: 6px;
  transition: all var(--transition-fast);
  text-align: center;
}

.verticals__tab:hover { color: var(--text-primary); }
.verticals__tab--active { color: var(--text-primary); background: var(--bg-elevated); }

.verticals__content {
  border-radius: 0 0 8px 8px;
  border-top: none;
}

.verticals__panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

.verticals__panel-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.verticals__panel-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.verticals__features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.verticals__features li {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  padding-left: 16px;
  position: relative;
}

.verticals__features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--success);
  font-size: 0.6875rem;
}

.verticals__compliance-badge {
  display: inline-block;
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--success);
  background: var(--success-muted);
  padding: 4px 10px;
  border-radius: 4px;
}

.verticals__quote {
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 24px;
}

.verticals__quote p {
  font-size: 0.9375rem;
  color: var(--text-primary);
  font-style: italic;
  line-height: 1.6;
  margin-bottom: 16px;
}

.verticals__quote footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.verticals__quote strong {
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.verticals__quote .text-muted {
  font-size: 0.75rem;
}

/* Testimonials */
.testimonials {
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 24px;
}

.testimonials__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.testimonials__card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.testimonials__text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  font-style: italic;
}

.testimonials__author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.testimonials__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.testimonials__name {
  display: block;
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.testimonials__role {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-muted);
}
</style>
