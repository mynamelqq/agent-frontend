<template>
  <div class="runtime-tool" :class="{ expanded }">
    <button type="button" class="runtime-tool-row" :aria-expanded="expanded" @click="expanded = !expanded">
      <svg class="runtime-tool-icon" width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.25" y="2.75" width="15.5" height="14.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path d="m5.75 7 2.5 2.5-2.5 2.5M10.5 12.25h3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="runtime-tool-name">{{ isMcp ? `MCP: ${resolvedToolName}` : resolvedToolName }}</span>
      <span v-if="summaryText" class="runtime-tool-summary" :title="summaryText">{{ summaryText }}</span>
      <svg class="runtime-tool-chevron" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <div v-if="expanded" class="tool-details">
      <div class="detail-section"><div class="detail-heading">{{ argsLabel }}</div><pre class="detail-content">{{ formattedArgs || '—' }}</pre></div>
      <div class="detail-section"><div class="detail-heading">{{ resultLabel }}</div><pre class="detail-content" :class="{ waiting: !hasResult }">{{ hasResult ? formattedResult : waitingLabel }}</pre></div>
      <div class="detail-actions"><span>{{ [exitCodeLabel, costLabel].filter(Boolean).join(' · ') }}</span><button type="button" :disabled="!hasResult" @click="copyResult">{{ copyBtnText }}</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
type LangMode = 'zh' | 'en' | 'bilingual'
const props = withDefaults(defineProps<{
  toolName: string
  displayName?: string
  langMode?: LangMode
  args?: string
  result?: string | null
  cost?: number
  isMcp?: boolean
}>(), { args: '', result: null, langMode: 'zh', isMcp: false })
const expanded = ref(false)
const copyBtnText = ref('')
const isEn = computed(() => props.langMode === 'en')
const isZh = computed(() => props.langMode === 'zh')
const hasResult = computed(() => props.result != null)
const resolvedToolName = computed(() => props.displayName || props.toolName)
const argsLabel = computed(() => isEn.value ? 'Input' : isZh.value ? '输入' : '输入 / Input')
const resultLabel = computed(() => isEn.value ? 'Output' : isZh.value ? '输出' : '输出 / Output')
const waitingLabel = computed(() => isEn.value ? 'Waiting for result…' : '等待工具返回结果…')
function parseJson(value: string | null | undefined): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
const parsedResult = computed(() => parseJson(props.result))
const costLabel = computed(() => props.cost != null && props.cost > 0 ? `${Math.round(props.cost)}ms` : '')
const exitCodeLabel = computed(() => {
  const result = parsedResult.value
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ''
  const code = (result as Record<string, unknown>).exitCode
  return code == null ? '' : `exit ${code}`
})
function formatValue(value: string | null | undefined): string {
  if (value == null) return ''
  const parsed = parseJson(value)
  if (parsed === null) return value
  return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
}
const formattedArgs = computed(() => formatValue(props.args))
const formattedResult = computed(() => formatValue(props.result))
function shortText(value: unknown, max = 90): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
const summaryText = computed(() => {
  const args = parseJson(props.args)
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    const obj = args as Record<string, unknown>
    for (const key of ['command', 'query', 'keyword', 'keywords', 'prompt', 'text', 'url', 'path', 'fileName', 'name']) {
      if (obj[key] != null && String(obj[key]).trim()) return shortText(obj[key])
    }
    const first = Object.values(obj).find(value => typeof value === 'string' && value.trim())
    if (first) return shortText(first)
  }
  return props.args ? shortText(formatValue(props.args)) : hasResult.value ? shortText(formattedResult.value) : ''
})
watch(() => props.langMode, () => { copyBtnText.value = isEn.value ? 'Copy output' : isZh.value ? '复制输出' : '复制输出 / Copy' }, { immediate: true })
async function copyResult() {
  if (!hasResult.value) return
  try {
    await navigator.clipboard.writeText(formattedResult.value)
    copyBtnText.value = isEn.value ? 'Copied' : '已复制'
    window.setTimeout(() => { copyBtnText.value = isEn.value ? 'Copy output' : '复制输出' }, 1500)
  } catch { copyBtnText.value = isEn.value ? 'Copy failed' : '复制失败' }
}
</script>

<style scoped>
.runtime-tool { width: 100%; color: #525866; }
.runtime-tool-row { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 34px; padding: 4px 6px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.runtime-tool-row:hover { color: #242b36; }
.runtime-tool-row:focus-visible { outline: 2px solid #7e9ac2; outline-offset: 2px; }
.runtime-tool-icon { width: 17px; height: 17px; flex: none; color: #8b929d; }
.runtime-tool-name { flex: none; color: #363d47; font-weight: 500; }
.runtime-tool-summary { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #8a9099; }
.runtime-tool-chevron { width: 15px; height: 15px; flex: none; margin-left: auto; color: #9ca2aa; transition: transform .18s ease; }
.runtime-tool.expanded .runtime-tool-chevron { transform: rotate(180deg); }
.tool-details { margin: 4px 0 10px 25px; padding: 8px 12px; border-left: 1px solid #e2e5e9; }
.detail-section + .detail-section { margin-top: 12px; }
.detail-heading { margin-bottom: 5px; color: #888f99; font-size: 11px; }
.detail-content { max-height: 240px; margin: 0; padding: 9px 11px; overflow: auto; border-radius: 6px; background: #f6f7f8; color: #4b5563; font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-content.waiting { color: #9299a2; }
.detail-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 28px; color: #969da6; font-size: 11px; }
.detail-actions button { margin-left: auto; padding: 3px 0; border: 0; background: transparent; color: #65748a; font: inherit; cursor: pointer; }
.detail-actions button:disabled { opacity: .45; cursor: default; }
:global(.dark) .runtime-tool { color: #aab3bf; }
:global(.dark) .runtime-tool-name, :global(.dark) .runtime-tool-row:hover { color: #e2e8f0; }
:global(.dark) .runtime-tool-summary, :global(.dark) .runtime-tool-icon { color: #8994a3; }
:global(.dark) .tool-details { border-left-color: #364152; }
:global(.dark) .detail-content { background: #1c2634; color: #cbd5e1; }
</style>
