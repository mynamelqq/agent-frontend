<template>
  <div class="agent-home">
    <h1>{{ t('今天想聊点什么？', 'What can I help you with today?') }}</h1>
  </div>
</template>

<script setup lang="ts">
import { useUiLanguage } from '../composables/useUiLanguage'
const { t } = useUiLanguage()
</script>

<style scoped>
.agent-home { text-align: center; padding: 0 24px; margin-bottom: 20px; }
h1 { margin: 0; color: #202124; font-size: clamp(24px, 2.3vw, 28px); font-weight: 500; line-height: 1.4; letter-spacing: -0.5px; }
:global(.dark) h1 { color: #f1f1f1; }
@media (max-width: 640px) { .agent-home { margin-bottom: 16px; } }
</style>
