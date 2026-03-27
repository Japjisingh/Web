export default defineNuxtConfig({
  devtools: { enabled: true },

  css: [
    '~/assets/styles/tokens.css',
    '~/assets/styles/base.css',
    '~/assets/styles/animations.css',
  ],

  modules: ['@unocss/nuxt', '@vueuse/motion/nuxt'],

  app: {
    head: {
      title: 'NeuralGate — AI Gateway & Cost Optimisation',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: 'Track every token. Cache every repeat. Route to cheaper models automatically.' },
        { name: 'theme-color', content: '#050507' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:4000',
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/app/**': { ssr: false },
  },

  nitro: {
    preset: 'node-server',
  },

  compatibilityDate: '2025-01-01',
})
