<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar__top">
        <!-- Logo -->
        <div class="sidebar__logo">
          <span class="sidebar__logo-text mono">NeuralGate</span>
          <StatusDot color="success" :pulse="true" />
        </div>

        <!-- Org switcher -->
        <button class="sidebar__org-switcher">
          <span class="sidebar__org-name truncate">Acme Corp</span>
          <ChevronsUpDown :size="14" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav">
        <div class="sidebar__group">
          <span class="sidebar__group-label">Monitor</span>
          <NuxtLink to="/app/overview" class="sidebar__link" active-class="sidebar__link--active">
            <LayoutGrid :size="16" /><span>Overview</span>
          </NuxtLink>
          <NuxtLink to="/app/requests" class="sidebar__link" active-class="sidebar__link--active">
            <List :size="16" /><span>Requests</span>
          </NuxtLink>
        </div>

        <div class="sidebar__group">
          <span class="sidebar__group-label">Optimise</span>
          <NuxtLink to="/app/analytics" class="sidebar__link" active-class="sidebar__link--active">
            <BarChart3 :size="16" /><span>Analytics</span>
          </NuxtLink>
          <NuxtLink to="/app/optimisation" class="sidebar__link" active-class="sidebar__link--active">
            <Sparkles :size="16" /><span>Savings</span>
            <span class="sidebar__badge sidebar__badge--success">£890</span>
          </NuxtLink>
        </div>

        <div class="sidebar__group">
          <span class="sidebar__group-label">Build</span>
          <NuxtLink to="/app/playground" class="sidebar__link" active-class="sidebar__link--active">
            <Terminal :size="16" /><span>Playground</span>
          </NuxtLink>
          <NuxtLink to="/app/agents" class="sidebar__link" active-class="sidebar__link--active">
            <Cpu :size="16" /><span>Agents</span>
          </NuxtLink>
          <NuxtLink to="/app/prompt-library" class="sidebar__link" active-class="sidebar__link--active">
            <BookOpen :size="16" /><span>Prompt Library</span>
          </NuxtLink>
          <NuxtLink to="/app/experiments" class="sidebar__link" active-class="sidebar__link--active">
            <FlaskConical :size="16" /><span>Experiments</span>
          </NuxtLink>
        </div>

        <div class="sidebar__group">
          <span class="sidebar__group-label">Manage</span>
          <NuxtLink to="/app/api-keys" class="sidebar__link" active-class="sidebar__link--active">
            <Key :size="16" /><span>API Keys</span>
          </NuxtLink>
          <NuxtLink to="/app/providers" class="sidebar__link" active-class="sidebar__link--active">
            <Plug :size="16" /><span>Providers</span>
          </NuxtLink>
          <NuxtLink to="/app/alerts" class="sidebar__link" active-class="sidebar__link--active">
            <Bell :size="16" /><span>Alerts</span>
          </NuxtLink>
          <NuxtLink to="/app/settings" class="sidebar__link" active-class="sidebar__link--active">
            <Settings :size="16" /><span>Settings</span>
          </NuxtLink>
        </div>
      </nav>

      <!-- Bottom -->
      <div class="sidebar__bottom">
        <div class="sidebar__plan-badge mono">Growth Plan</div>
        <div class="sidebar__user">
          <div class="sidebar__avatar">J</div>
          <span class="sidebar__user-name truncate">Jane Smith</span>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main-wrapper">
      <!-- Top bar -->
      <header class="topbar">
        <div class="topbar__left">
          <h1 class="topbar__title">{{ pageTitle }}</h1>
        </div>
        <div class="topbar__right">
          <DateRangePicker />
          <button class="topbar__icon-btn" title="Search (Cmd+K)" @click="commandPalette.open()">
            <Search :size="16" />
          </button>
          <button class="topbar__icon-btn" title="Notifications">
            <Bell :size="16" />
          </button>
        </div>
      </header>

      <!-- Page content -->
      <main class="main-content">
        <slot />
      </main>
    </div>

    <!-- Global components -->
    <Toast />
    <CommandPalette />
  </div>
</template>

<script setup lang="ts">
import {
  LayoutGrid, List, BarChart3, Sparkles, Terminal, Cpu, BookOpen,
  FlaskConical, Key, Plug, Bell, Settings, Search, ChevronsUpDown,
} from 'lucide-vue-next'

const route = useRoute()
const commandPalette = useCommandPalette()

const pageTitles: Record<string, string> = {
  '/app/overview': 'Overview',
  '/app/requests': 'Requests',
  '/app/analytics': 'Analytics',
  '/app/optimisation': 'Savings Centre',
  '/app/playground': 'Playground',
  '/app/agents': 'Agents',
  '/app/prompt-library': 'Prompt Library',
  '/app/experiments': 'Experiments',
  '/app/api-keys': 'API Keys',
  '/app/providers': 'Providers',
  '/app/alerts': 'Alerts',
  '/app/settings': 'Settings',
}

const pageTitle = computed(() => pageTitles[route.path] || 'Dashboard')

// Register nav items in command palette
commandPalette.register(
  Object.entries(pageTitles).map(([path, label]) => ({
    id: path,
    label,
    group: 'Navigation',
    action: () => navigateTo(path),
  })),
)
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: var(--z-sticky);
}

.sidebar__top {
  padding: 16px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid var(--border-base);
}

.sidebar__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.sidebar__logo-text {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar__org-switcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.sidebar__org-switcher:hover {
  border-color: var(--border-strong);
}

.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar__group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar__group-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 8px 6px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  text-decoration: none;
}

.sidebar__link:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.sidebar__link--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.sidebar__badge {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 9999px;
}

.sidebar__badge--success {
  color: var(--success);
  background: var(--success-muted);
}

.sidebar__bottom {
  padding: 12px;
  border-top: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar__plan-badge {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--primary);
  background: var(--primary-muted);
  padding: 4px 10px;
  border-radius: 6px;
  text-align: center;
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.sidebar__user-name {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Main */
.main-wrapper {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
}

.topbar {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-base);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.topbar__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.topbar__icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.main-content {
  flex: 1;
  padding: 24px;
}
</style>
