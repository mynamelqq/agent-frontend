<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { transformMarkdownForStream } from "../utils/markdown";
import { getUser } from "../stores/auth";

const props = withDefaults(
  defineProps<{
    thinkchunk?: string;
    thinking?: boolean;
    /** 推理耗时（毫秒），用于头部展示，可选 */
    thinkingTime?: number;
    /** Agent 运行记录中的无边框样式 */
    minimal?: boolean;
    /** 标题文案，默认 "Thought" */
    label?: string;
  }>(),
  { label: 'Thought' }
);

const SETTINGS_STORAGE_KEY = 'chatui_user_setting_v1';

function storageKeyForUser(userId: string) {
  return `${SETTINGS_STORAGE_KEY}:${userId || 'anon'}`;
}

function readFoldingThinking(userId: string): boolean | null {
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { foldingThinking?: unknown };
    return typeof parsed.foldingThinking === 'boolean' ? parsed.foldingThinking : null;
  } catch {
    return null;
  }
}

const collapsed = ref(true);

function applyFoldingThinking(v: unknown) {
  if (typeof v === 'boolean') {
    collapsed.value = v;
  }
}

function handleUserSettingUpdated(ev: Event) {
  const e = ev as CustomEvent<any>;
  const detail = e.detail as { foldingThinking?: unknown } | undefined;
  if (!detail) return;
  applyFoldingThinking(detail.foldingThinking);
}

onMounted(() => {
  const u = getUser();
  let userId = u?.id ? String(u.id) : '';
  if (!userId) userId = 'anon';

  const local = readFoldingThinking(userId);
  if (local !== null) {
    applyFoldingThinking(local);
  }

  try {
    window.addEventListener('userSetting:updated', handleUserSettingUpdated as EventListener);
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  try {
    window.removeEventListener('userSetting:updated', handleUserSettingUpdated as EventListener);
  } catch {
    // ignore
  }
});

// 推理内容容器，用于自动滚动
const contentWrapRef = ref<HTMLElement | null>(null);
// 是否允许自动滚动到底部（用户上滑则关闭，回到底部再开启）
const autoScrollToBottom = ref(true);

function scrollThinkToBottom(force = false) {
  nextTick(() => {
    const el = contentWrapRef.value;
    if (!el) return;
    if (!force && !autoScrollToBottom.value) return;
    el.scrollTop = el.scrollHeight;
  });
}

function handleThinkScroll() {
  const el = contentWrapRef.value;
  if (!el) return;
  const distanceToBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
  const THRESHOLD = 12; // 距离底部 12px 内视为在底部
  autoScrollToBottom.value = distanceToBottom <= THRESHOLD;
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  if (!collapsed.value) {
    autoScrollToBottom.value = true;
    scrollThinkToBottom(true);
  }
}

function handleMinimalKeydown(event: KeyboardEvent) {
  if (!props.minimal || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  toggleCollapsed();
}

// 在推理内容追加时，如果未折叠且仍允许自动滚动，则滚动到底部
watch(
  () => props.thinkchunk,
  () => {
    if (collapsed.value) return;
    scrollThinkToBottom();
  }
);

// Markdown 渲染推理内容
const renderedHtml = computed(() => {
  const content = props.thinkchunk || "";
  return transformMarkdownForStream(content, {
    appendCursor: false,
    allowEmpty: true
  });
});

const thinkingSeconds = computed(() => {
  const ms = typeof props.thinkingTime === 'number' ? props.thinkingTime : 0;
  if (!ms || ms <= 0) return '';
  return `${Math.round(ms / 1000)}s`;
});
</script>

<template>
  <div class="think-card" :class="{ minimal: props.minimal }">
    <!-- 顶部按钮和状态 -->
    <div
      class="think-header"
      :role="props.minimal ? 'button' : undefined"
      :tabindex="props.minimal ? 0 : undefined"
      :aria-expanded="props.minimal ? !collapsed : undefined"
      @click="props.minimal && toggleCollapsed()"
      @keydown="handleMinimalKeydown"
    >
      <div class="think-label">
        <div v-if="thinking" class="think-thinking">
          <span>{{ props.minimal ? '思考中' : 'thinking' }}</span>
          <span v-if="props.minimal && thinkingSeconds" class="think-time">{{ thinkingSeconds }}</span>
          <div class="think-spinner" style="animation: think-spinner-rotate 1s linear infinite;">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24px"
              height="24px"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8"
              ></path>
            </svg>
          </div>
        </div>
        <div v-else>
          {{ props.label }}
          <span v-if="thinkingSeconds" class="think-time">{{ thinkingSeconds }}</span>
        </div>
      </div>
      <svg v-if="props.minimal" class="think-chevron" :class="{ expanded: !collapsed }" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <button
        v-if="!props.minimal"
        class="think-toggle"
        @click="toggleCollapsed"
      >
        {{ collapsed ? "展开" : "折叠" }}
      </button>
    </div>

    <!-- Markdown 内容 -->
    <div
      class="think-content-wrap"
      :class="{ collapsed }"
      ref="contentWrapRef"
      @scroll="handleThinkScroll"
    >
      <article class="think-content" v-html="renderedHtml" />
    </div>
  </div>
</template>

<style scoped>
/* 淡色折叠块：虚线边框、极浅背景、小一号字，不像日志 */
.think-card {
  position: relative;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  max-width: 640px;
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px dashed var(--border-medium, #d1d5db);
  background: var(--think-bg, rgba(0, 0, 0, 0.03));
  padding: 0.5rem 0.75rem;
  box-shadow: none;
}
.think-card.minimal {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
:root.dark .think-card.minimal,
.dark .think-card.minimal {
  border: 0;
  background: transparent;
}
.think-card.minimal .think-header { min-height: 32px; padding: 3px 6px; border-radius: 6px; cursor: pointer; justify-content: flex-start; gap: 7px; }
.think-card.minimal .think-header:hover { background: rgba(105, 125, 150, .07); }
.think-card.minimal .think-header:focus-visible { outline: 2px solid #7e9ac2; outline-offset: 2px; }
.think-card.minimal .think-header:hover .think-label { color: var(--text-secondary, #374151); }
.think-card.minimal .think-content-wrap { border-left: 1px solid var(--border-light, #e5e7eb); margin-left: 13px; padding-left: 12px; }
.think-card.minimal .think-content-wrap.collapsed { padding: 0; }
.think-card.minimal .think-label { font-size: 13px; }
.think-card.minimal .think-time { margin-left: 8px; color: #929aa5; font-size: 12px; font-weight: 400; }
.think-chevron { flex: none; color: #a1a8b1; transition: transform .18s ease; }
.think-chevron.expanded { transform: rotate(180deg); }
:root.dark .think-card,
.dark .think-card {
  background: var(--think-bg-dark, rgba(255, 255, 255, 0.05));
  border-color: var(--border-medium, #374151);
}

.think-header {
  margin-bottom: 0;
  display: flex;
  user-select: none;
  align-items: center;
  justify-content: space-between;
}

.think-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted, #6b7280);
}
:root.dark .think-label,
.dark .think-label {
  color: var(--text-muted, #9ca3af);
}

.think-thinking {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.think-spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.think-toggle {
  border-radius: 9999px;
  background: transparent;
  padding: 0.2rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-muted, #6b7280);
  border: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.think-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-secondary, #374151);
}
:root.dark .think-toggle,
.dark .think-toggle {
  color: #9ca3af;
}
:root.dark .think-toggle:hover,
.dark .think-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
}

.think-content-wrap {
  border-left: 1px dashed var(--border-light, #e5e7eb);
  padding-left: 0.75rem;
  margin-top: 0.375rem;
  max-height: 140px;
  overflow-y: auto;
}
:root.dark .think-content-wrap,
.dark .think-content-wrap {
  border-color: var(--border-medium, #4b5563);
}

.think-content {
  max-width: 100%;
  font-size: 0.7875rem;
  line-height: 1.5;
  color: var(--text-secondary, #4b5563);
}
:root.dark .think-content,
.dark .think-content {
  color: var(--text-muted, #9ca3af);
}

.think-content-wrap.collapsed {
  max-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: none;
}

/* 推理内容 Markdown 基础排版 */
.think-content :deep(p) { margin: 0.5em 0; }
.think-content :deep(p:first-child) { margin-top: 0; }
.think-content :deep(p:last-child) { margin-bottom: 0; }
.think-content :deep(ul),
.think-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.think-content :deep(li) { margin: 0.25em 0; }
.think-content :deep(strong) { font-weight: 600; color: #111827; }
:root.dark .think-content :deep(strong),
.dark .think-content :deep(strong) { color: #f9fafb; }
.think-content :deep(em) { font-style: italic; }
.think-content :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
:root.dark .think-content :deep(code) {
  background: rgba(255, 255, 255, 0.15);
}
</style>
