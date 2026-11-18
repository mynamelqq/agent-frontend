<template>
  <div class="agent-container">
    <!-- 头部：参考 Chat.vue chat-header -->
    <div class="chat-header">
      <div class="chat-title-section">
        <button v-if="!showHome" class="back-button" @click="goBack" title="返回">
          ←
        </button>
        <div class="chat-info">
          <div class="chat-title">{{ showHome ? '智能体' : '智能体对话' }}</div>
          <div class="chat-subtitle">{{ showHome ? '选择或创建会话' : `${messages.length} 条消息` }}</div>
        </div>
      </div>
      <div class="chat-actions">
        <NotificationCenter />
      </div>
    </div>

    <!-- 主内容区： -->
    <div class="agent-main">
      <!-- 左侧：首页 或 对话区 -->
      <div class="agent-left">
        <!-- 智能体首页（无 sessionId 时展示） -->
        <!-- 对话区（有 sessionId 时展示） -->
          <div class="agent-chat" :class="{ 'agent-chat-home': showHome }">
        <AgentHome v-if="showHome" />
        <div v-show="!showHome" class="messages-container" ref="messagesContainer" @scroll="handleMessagesScroll">
          <div v-for="(msg, idx) in messages" :key="msg.id || `${msg.runId || 'legacy'}-${idx}`" class="message-group" :class="msg.role">
            <!-- 用户消息 -->
            <div v-if="msg.role === 'user' && msg.attachments?.length" class="agent-message-attachments">
              <template v-for="attachment in msg.attachments" :key="attachment.id">
                <button v-if="attachment.fileUrl && attachment.fileType?.startsWith('image/')" type="button" class="agent-message-attachment" @click="openAgentImagePreview(attachment.fileUrl, attachment.fileName)">
                  <img :src="attachment.fileUrl" :alt="attachment.fileName" class="agent-message-attachment-image" />
                  <span :title="attachment.fileName">{{ attachment.fileName || '图片' }}</span>
                </button>
                <a v-else-if="attachment.fileUrl" class="agent-message-attachment" :href="attachment.fileUrl" target="_blank" rel="noopener">
                  <span class="agent-message-file-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" fill="currentColor" opacity=".14"/><path d="M18 3.5v6a2 2 0 0 0 2 2h5M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 18h10M11 22h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span :title="attachment.fileName">{{ attachment.fileName || '附件' }}</span>
                </a>
                <span v-else class="agent-message-attachment"><span class="agent-message-file-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" fill="currentColor" opacity=".14"/><path d="M18 3.5v6a2 2 0 0 0 2 2h5M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 18h10M11 22h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span :title="attachment.fileName">{{ attachment.fileName || '附件' }}</span></span>
              </template>
            </div>
            <div v-if="msg.role === 'user'" class="message-bubble user">
              <div class="message-content">{{ msg.content }}</div>
            </div>

            <!-- AI 消息 -->
            <div v-else class="message-bubble assistant">
              <div
                v-if="(msg.steps?.length || 0) > 0 || (isRunning && idx === messages.length - 1)"
                class="agent-run"
              >
                <button
                  type="button"
                  class="agent-run-toggle"
                  :class="{ 'is-running': isRunning && idx === messages.length - 1 }"
                  :aria-expanded="!!msg.thinkingExpanded"
                  @click="msg.thinkingExpanded = !msg.thinkingExpanded"
                >
                  <span class="agent-run-title">思考过程</span>
                  <span class="agent-run-duration">{{ getRunDurationLabel(msg, idx) }}</span>
                  <svg class="agent-run-chevron" :class="{ expanded: msg.thinkingExpanded }" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <div v-show="msg.thinkingExpanded" class="agent-run-details">
                  <template v-for="(step, si) in (msg.steps || [])" :key="'step-' + si">
                    <Think v-if="step.reasoning" :thinkchunk="step.reasoning" :thinking="false" :thinking-time="step.thinkingTime" label="思考" minimal />
                    <div v-if="step.content" class="message-content assistant-body agent-step-text" v-html="renderStepText(step.content)"></div>
                    <template v-for="(tc, ti) in (step.tools || [])" :key="'tc-' + si + '-' + ti">
                      <ToolCallCard :toolName="tc.toolName" :displayName="getToolDisplayName(tc.toolName)" :langMode="toolLangMode" :args="tc.args" :result="tc.result" :displayResult="tc.displayResult" :displayFormat="tc.displayFormat" :language="tc.language" :cost="tc.cost" :isMcp="tc.isMcp" />
                      <div v-if="isFileTool(tc.toolName) && getParsedFiles(tc).length" class="generated-files-block">
                        <GeneratedFileCard v-for="(file, fi) in getParsedFiles(tc)" :key="fi" :fileName="file.fileName" :fileType="file.fileType" :url="file.url" :contentBase64="file.contentBase64" :mimeType="file.mimeType" :size="file.size" />
                      </div>
                    </template>
                  </template>
                  <template v-if="isRunning && idx === messages.length - 1">
                    <Think v-if="currentStep.reasoning" :thinkchunk="currentStep.reasoning" :thinking="true" :thinking-time="currentStep.thinkingTime" label="思考" minimal />
                    <div v-if="currentStep.content" class="message-content assistant-body agent-step-text" v-html="renderStepText(currentStep.content)"></div>
                    <template v-for="(tc, ti) in (currentStep.tools || [])" :key="'stream-tc-' + ti">
                      <ToolCallCard :toolName="tc.toolName" :displayName="getToolDisplayName(tc.toolName)" :langMode="toolLangMode" :args="tc.args" :result="tc.result" :displayResult="tc.displayResult" :displayFormat="tc.displayFormat" :language="tc.language" :cost="tc.cost" :isMcp="tc.isMcp" />
                      <div v-if="isFileTool(tc.toolName) && getParsedFiles(tc).length" class="generated-files-block">
                        <GeneratedFileCard v-for="(file, fi) in getParsedFiles(tc)" :key="fi" :fileName="file.fileName" :fileType="file.fileType" :url="file.url" :contentBase64="file.contentBase64" :mimeType="file.mimeType" :size="file.size" />
                      </div>
                    </template>
                  </template>
                </div>
              </div>

              <div v-if="msg.attachmentLoading" class="attachment-loading">
                <span class="attachment-loading-text">正在读取附件...</span>
                <span class="attachment-loading-wave" aria-hidden="true"></span>
              </div>

              <!-- 正文内容（流式时用 markdown 流式渲染） -->
              <div class="message-content assistant-body" v-html="getAssistantMessageHtml(msg)"></div>
              <div v-if="msg.content && (!isRunning || idx !== messages.length - 1)" class="agent-message-actions">
                <div class="agent-message-toolbar">
                  <button type="button" class="agent-message-action" :title="copiedMessage === msg ? '已复制' : '复制正文'" :aria-label="copiedMessage === msg ? '已复制' : '复制正文'" :disabled="!msg.content" @click="copyAssistantMessage(msg)">
                    <svg v-if="copiedMessage === msg" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
                  </button>
                  <button v-if="hasMessageDetails(msg)" type="button" class="agent-message-action" title="详细情况" aria-label="详细情况" :aria-expanded="!!msg.detailsExpanded" @click="msg.detailsExpanded = !msg.detailsExpanded">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
                  </button>
                </div>
                <div v-if="msg.detailsExpanded && hasMessageDetails(msg)" class="agent-message-details">
                  <div v-if="msg.tokens != null || msg.promptTokens != null || msg.completionTokens != null || msg.cachedTokens != null"><span>总 Token</span><strong>{{ msg.tokens ?? ((msg.promptTokens ?? 0) + (msg.completionTokens ?? 0) + (msg.cachedTokens ?? 0)) }}</strong></div>
                  <div v-if="msg.promptTokens != null"><span>提示 Token</span><strong>{{ msg.promptTokens }}</strong></div>
                  <div v-if="msg.completionTokens != null"><span>输出 Token</span><strong>{{ msg.completionTokens }}</strong></div>
                  <div v-if="msg.cachedTokens != null"><span>缓存 Token</span><strong>{{ msg.cachedTokens }}</strong></div>
                  <div v-if="getRunDurationLabel(msg, idx)"><span>耗时</span><strong>{{ getRunDurationLabel(msg, idx).replace(/^用时 /, '') }}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 加载历史消息状态 -->
          <div v-if="messagesLoading" class="messages-loading">
            <div class="loading-dots">
              <div class="loading-dot"></div>
              <div class="loading-dot"></div>
              <div class="loading-dot"></div>
            </div>
            <span class="messages-loading-text">正在加载会话内容...</span>
          </div>
          <!-- 响应建立前与运行中使用相同的“思考过程”提示 -->
          <div
            v-else-if="isRunning && messages[messages.length - 1]?.role !== 'assistant'"
            class="agent-run agent-run-pending"
            role="status"
          >
            <div class="agent-run-toggle is-running">
              <span class="agent-run-title">思考过程</span>
            </div>
          </div>
        </div>

        <!-- 底部输入框，增加附件功能（参考 Chat.vue） -->
        <div class="input-container">
          <!-- 附件展示区：简单卡片列表 -->
          <div v-if="agentAttachments.length > 0" class="attachments-list">
            <div
              v-for="item in agentAttachments"
              :key="item.id"
              class="attach-card"
            >
              <button
                v-if="item.file.type.startsWith('image/') && item.status === 'done' && item.fileUrl"
                type="button"
                class="attach-card-icon attach-card-preview-btn"
                @click="openAgentImagePreview(item.fileUrl, item.file.name)"
              >
                <img :src="item.fileUrl" class="attach-card-img" :alt="item.file.name" />
              </button>
              <div v-else class="attach-card-icon">
                <template v-if="item.file.type.startsWith('image/') && item.status === 'done' && item.fileUrl">
                  <img :src="item.fileUrl" class="attach-card-img" :alt="item.file.name" />
                </template>
                <template v-else>
                  <span class="attach-card-file-icon" :class="{ 'is-text': isAgentTextLikeFile(item.file.name, item.file.type) }">
                    <svg class="attach-card-file-svg" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M6.75 3A2.75 2.75 0 0 0 4 5.75v12.5A2.75 2.75 0 0 0 6.75 21h10.5A2.75 2.75 0 0 0 20 18.25V9.06a.75.75 0 0 0-.24-.55l-5.5-5.1A.75.75 0 0 0 13.75 3h-7Zm7.75 1.9L18.2 8.33h-2.2A1.5 1.5 0 0 1 14.5 6.8V4.9Z"
                      />
                    </svg>
                    <span class="attach-card-ext-pill">{{ getAgentFileExt(item.file.name) }}</span>
                  </span>
                </template>
                <!-- 简单圆圈进度条 -->
                <svg
                  v-if="item.status !== 'done' || item.error"
                  class="attach-card-progress"
                  viewBox="0 0 36 36"
                  width="36"
                  height="36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="var(--slate-200)"
                    stroke-width="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    :stroke="item.status === 'error' ? 'var(--red-500)' : 'var(--slate-500)'"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-dasharray="94.25"
                    :stroke-dashoffset="94.25 - (item.progress / 100) * 94.25"
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              </div>
              <div class="attach-card-body">
                <span class="attach-card-name">{{ item.file.name }}</span>
                <span class="attach-card-type">{{
                  item.status === 'error'
                    ? '上传失败'
                    : item.file.type.startsWith('image/')
                      ? '图片'
                      : '文件'
                }}</span>
              </div>
              <button
                type="button"
                class="attach-card-remove"
                title="删除附件"
                @click="removeAgentAttachment(item.id)"
                aria-label="删除"
              >
                ×
              </button>
            </div>
          </div>

          <div
            class="input-box-container"
            :class="{ 'input-box-has-attachments': agentAttachments.length > 0 }"
            :style="{ '--input-max-height': `${INPUT_MAX_HEIGHT_PX}px` }"
          >
            <button class="composer-add" title="添加附件" aria-label="添加附件" type="button" :disabled="isRunning || agentIsUploading" @click="triggerAgentFileSelect">＋</button>
            <textarea
              ref="messageInputRef"
              v-model="userInput"
              class="message-input"
              placeholder="向智能体提问"
              :disabled="isRunning"
              @input="scheduleAutoResizeMessageInput"
              @compositionend="scheduleAutoResizeMessageInput"
              @keydown.enter.exact.prevent="handleSend"
              rows="1"
            ></textarea>
            <!-- 右侧操作区：附件按钮 + 发送/停止 -->
            <div class="input-trailing">
              <button
                class="input-action-btn legacy-attach-button"
                title="添加附件"
                type="button"
                :disabled="isRunning || agentIsUploading"
                @click="triggerAgentFileSelect"
              >
                <svg v-if="!agentIsUploading" class="attach-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M7.5 12.75 13.8 6.44a3.25 3.25 0 0 1 4.6 4.6l-7.14 7.14a5 5 0 1 1-7.07-7.08l7.15-7.14a.75.75 0 0 1 1.06 1.06L5.25 12.17a3.5 3.5 0 0 0 4.95 4.95l7.14-7.14a1.75 1.75 0 1 0-2.47-2.47l-6.3 6.3a.75.75 0 1 1-1.06-1.06Z"
                  />
                </svg>
                <div v-else class="loading-spinner"></div>
              </button>
              <input
                ref="agentFileInput"
                type="file"
                accept=".mp4,.mkv,.mov,video/mp4,video/x-matroska,video/matroska,video/quicktime,image/*"
                style="display: none"
                @change="handleAgentFileChange"
              />
              <button
                type="button"
                class="input-action-btn mic-btn-trailing"
                :class="{ 'mic-btn-recording': isDictating }"
                :disabled="isRunning"
                :title="isDictating ? '停止录音' : '语音输入'"
                :aria-label="isDictating ? '停止录音' : '语音输入'"
                @click="toggleDictation"
              >
                <svg
                  v-if="!isDictating"
                  xmlns="http://www.w3.org/2000/svg"
                  class="mic-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="mic-icon mic-icon-stop"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
              <button
                v-if="isRunning"
                class="stop-btn-inline"
                type="button"
                @click="handleStop"
              >
                <span class="stop-icon">⏹</span>
              </button>
              <button
                v-else
                class="send-button"
                type="button"
                :disabled="!userInput.trim() || hasUnconfirmedAgentAttachments"
                @click="handleSend"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- 录音转写气泡：Teleport 到 body，固定于屏幕底部上方 -->
    <Teleport to="body">
      <Transition name="dictation-bubble">
        <div
          v-if="isDictating || dictationTranscript || dictationError"
          ref="dictationBubbleRef"
          class="dictation-bubble dictation-bubble-fixed"
          role="status"
          aria-live="polite"
        >
          <div class="dictation-bubble-content">
            <div v-if="dictationError" class="dictation-bubble-error">{{ dictationError }}</div>
            <div v-else-if="dictationTranscript" class="dictation-bubble-text">{{ dictationTranscript }}</div>
            <div v-else class="dictation-bubble-placeholder">正在聆听...</div>
          </div>
          <div class="dictation-bubble-actions">
            <button
                v-if="dictationTranscript && !dictationError"
              type="button"
              class="dictation-bubble-btn dictation-bubble-btn-primary"
              :disabled="!dictationTranscript"
              @click="submitDictationToInput"
            >
                使用文字
            </button>
            <button
              type="button"
              class="dictation-bubble-btn"
              @click="cancelDictation"
                aria-label="关闭语音提示"
            >
                ×
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 警告/错误提示 -->
    <div v-if="errorMessage" class="toast toast-error" @click="errorMessage = ''">
      <span class="toast-icon">⚠️</span>
      <span class="toast-text">{{ errorMessage }}</span>
    </div>
    <div v-if="warnMessage" class="toast toast-warn" @click="warnMessage = ''">
      <span class="toast-icon">⚠️</span>
      <span class="toast-text">{{ warnMessage }}</span>
    </div>
    <Teleport to="body">
      <div v-if="agentImagePreview.visible" class="image-preview-backdrop" @click="closeAgentImagePreview">
        <div class="image-preview-dialog" @click.stop>
          <button type="button" class="image-preview-close" @click="closeAgentImagePreview" aria-label="关闭">✕</button>
          <img :src="agentImagePreview.src" :alt="agentImagePreview.name" class="image-preview-img" />
          <div v-if="agentImagePreview.name" class="image-preview-name">{{ agentImagePreview.name }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isLoggedIn, getToken } from '../stores/auth'
import { apiFetch, apiFetchRaw } from '../api/http'
import { buildWsUrl } from '../api/base-url'
import { uploadFile } from '../api/upload'
import { compressMediaAttachment, isAllowedVideoFormat } from '../utils/attachment-compress'
import Think from '../components/Think.vue'
import ToolCallCard from '../components/ToolCallCard.vue'
import GeneratedFileCard from '../components/GeneratedFileCard.vue'
import AgentHome from '../components/AgentHome.vue'
import NotificationCenter from '../components/NotificationCenter.vue'
import { transformMarkdownForStream } from '../utils/markdown'
import { useUiLanguage } from '../composables/useUiLanguage'

const getAsrWsUrl = (): string => {
  return buildWsUrl('/api/ws/asr', 'VITE_ASR_WS_URL')
}

/** Float32 转 16kHz 16bit PCM（用于 ASR） */
function floatTo16BitPCM(float32Arr: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Arr.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32Arr.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

// 工具调用项（与 tool_result 成对展示）
interface ToolCallItem {
  toolCallId?: string
  toolName: string
  args: string
  result: string | null
  displayResult?: string
  displayFormat?: string
  language?: string
  isMcp?: boolean
  /** 单次工具执行耗时（毫秒），由 tool_result.cost 提供 */
  cost?: number
}

/** 解析后的生成文件项（供 GeneratedFileCard 使用） */
interface ParsedFileItem {
  fileName: string
  fileType: string
  url?: string
  contentBase64?: string
  mimeType?: string
  /** 文件大小（字节），可选 */
  size?: number
}

// 单个推理阶段（step）：包含一段推理文本及该阶段内的工具调用
interface MessageStep {
  reasoning?: string          // 该阶段的推理文本
  content?: string            // 后面仍有步骤或工具调用的阶段性文本
  thinkingTime?: number       // 该阶段推理耗时(ms)
  tools?: ToolCallItem[]      // 该阶段的工具调用列表
}

// 历史消息 payload（后端 AgentMessagePayload）
interface AgentMessagePayload {
  content?: string
  reasoning?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: string
  toolResult?: string
  displayResult?: string
  displayFormat?: string
  language?: string
  toolSuccess?: boolean
  /** 单次工具执行耗时（毫秒） */
  cost?: number
  thinkingTime?: number
  thinking_time?: number
  promptTokens?: number
  prompt_tokens?: number
  completionTokens?: number
  completion_tokens?: number
  cachedTokens?: number
  cached_tokens?: number
  tokens?: number
  token?: number
  usage?: Record<string, unknown>
  stats?: Record<string, unknown>
  meta?: Record<string, unknown>
}

// 类型定义
interface Message {
  id?: string
  runId?: string | null
  role: 'user' | 'assistant'
  content: string
  attachments?: AgentAttachmentVO[]
  /** 本条助手消息的推理阶段(step) 列表 */
  steps?: MessageStep[]
  /** 当前助手消息是否处于附件读取阶段 */
  attachmentLoading?: boolean
  thinkingExpanded?: boolean
  detailsExpanded?: boolean
  /** 整体推理耗时（毫秒），用于在推理卡片头部展示 */
  thinkingTime?: number
  /** 本次运行的本地开始时间和最终耗时（历史记录优先使用后端 cost） */
  runStartedAt?: number
  runDuration?: number
  /** usage 统计字段：提示/补全/缓存 token */
  promptTokens?: number
  completionTokens?: number
  cachedTokens?: number
  /** usage 统计字段：总耗时（毫秒）与总 token 数 */
  cost?: number
  tokens?: number
}

interface AgentAttachmentVO {
  id: string
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
}

interface AgentMessagesVO {
  messages: any[]
  attachmentsByRunId?: Record<string, AgentAttachmentVO[]>
}

interface UsageStats {
  thinkingTime?: number
  promptTokens?: number
  completionTokens?: number
  cachedTokens?: number
  cost?: number
  tokens?: number
}

interface AgentToolEventPayload {
  toolCallId?: string
  toolName?: string
  content?: string
  displayResult?: string
  displayFormat?: string
  language?: string
  meta?: Record<string, unknown>
  cost?: number
}

type ToolLangMode = 'zh' | 'en' | 'bilingual'
const TOOL_NAME_ZH_MAP: Record<string, string> = {
  maps_around_search: '周边地点搜索',
  maps_text_search: '地点文本搜索',
  maps_search_detail: '地点详情查询',
  maps_geo: '地址转坐标',
  maps_regeocode: '坐标转地址',
  maps_ip_location: 'IP 定位',
  maps_bicycling: '骑行路线规划',
  maps_direction_driving: '驾车路线规划',
  maps_direction_walking: '步行路线规划',
  maps_direction_transit_integrated: '公交路线规划',
  maps_direction_transit: '公交路线规划',
  maps_distance: '距离测量',
  maps_weather: '天气查询',
  execute_command: '执行命令',
  writeFile: '写入文件',
  generatePDF: '生成 PDF',
  generateExcel: '生成 Excel'
}

const normalizeToolName = (name: string): string => (name || '').trim()
const getToolZhName = (toolName: string): string => {
  const raw = normalizeToolName(toolName)
  if (!raw) return '未知工具'
  const direct = TOOL_NAME_ZH_MAP[raw]
  if (direct) return direct
  const lower = raw.toLowerCase()
  const lowerHit = Object.entries(TOOL_NAME_ZH_MAP).find(([k]) => k.toLowerCase() === lower)
  return lowerHit?.[1] || raw
}
const { uiLocale } = useUiLanguage()
const toolLangMode = computed<ToolLangMode>(() => (uiLocale.value === 'en' ? 'en' : 'zh'))
function getToolDisplayName(toolName: string): string {
  const raw = normalizeToolName(toolName) || 'unknown'
  const zh = getToolZhName(raw)
  if (toolLangMode.value === 'en') return raw
  if (toolLangMode.value === 'bilingual') {
    return zh === raw ? raw : `${zh} (${raw})`
  }
  return zh
}

const FILE_TOOL_NAMES = ['writeFile', 'generatePDF', 'generateExcel']
function isFileTool(toolName: string): boolean {
  return FILE_TOOL_NAMES.some((n) => (toolName || '').toLowerCase() === n.toLowerCase())
}
function isMcpToolName(toolName: string): boolean {
  return (toolName || '').trim().toLowerCase().startsWith('maps')
}
function getExt(pathOrName: string): string {
  if (!pathOrName) return ''
  const lastDot = pathOrName.lastIndexOf('.')
  return lastDot >= 0 ? pathOrName.slice(lastDot + 1).toLowerCase() : ''
}
function getFileNameFromPath(pathStr: string): string {
  if (!pathStr) return ''
  const norm = pathStr.replace(/\\/g, '/')
  return norm.split('/').pop() || pathStr
}
function getDefaultExtByTool(toolName: string): string {
  const n = (toolName || '').toLowerCase()
  if (n === 'generatepdf') return 'pdf'
  if (n === 'generateexcel') return 'xlsx'
  return ''
}
function parseFileToolResult(toolName: string, result: string | null): ParsedFileItem[] {
  if (!result) return []
  let obj: unknown
  try {
    obj = JSON.parse(result)
  } catch {
    return []
  }
  const defaultExt = getDefaultExtByTool(toolName)
  const items: ParsedFileItem[] = []
  const push = (raw: Record<string, unknown>) => {
    const path = String(raw.path ?? raw.filePath ?? '')
    const url = typeof raw.url === 'string' ? raw.url : ''
    const name = String(raw.fileName ?? raw.name ?? raw.filename ?? '')
    const content = raw.content ?? raw.contentBase64 ?? raw.data
    const contentBase64 = typeof content === 'string' ? content : ''
    const rawType = String(raw.fileType ?? raw.type ?? raw.extension ?? '')
    // 兼容 MIME（application/pdf 等）与扩展名
    let typeFromResult = rawType.toLowerCase()
    if (typeFromResult.includes('/')) {
      if (typeFromResult.includes('pdf')) typeFromResult = 'pdf'
      else if (
        typeFromResult.includes('excel') ||
        typeFromResult.includes('spreadsheet') ||
        typeFromResult.includes('sheet') ||
        typeFromResult.includes('xls')
      ) {
        typeFromResult = 'xlsx'
      } else if (typeFromResult.includes('markdown') || typeFromResult.includes('md')) {
        typeFromResult = 'md'
      } else if (typeFromResult.includes('json')) {
        typeFromResult = 'json'
      } else if (typeFromResult.includes('html')) {
        typeFromResult = 'html'
      } else if (typeFromResult.includes('css')) {
        typeFromResult = 'css'
      } else if (typeFromResult.includes('plain')) {
        typeFromResult = 'txt'
      }
    }
    const fileName = name || getFileNameFromPath(path) || (defaultExt ? `file.${defaultExt}` : 'download')
    const fileType = typeFromResult || getExt(fileName) || getExt(path) || defaultExt
    const sizeRaw = raw.size ?? raw.fileSize ?? raw.length ?? raw.bytes
    const size = typeof sizeRaw === 'number' ? sizeRaw : Number(sizeRaw)
    if (!url && !contentBase64) return
    items.push({
      fileName,
      fileType,
      url: url || undefined,
      contentBase64: contentBase64 || undefined,
      mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : undefined,
      size: Number.isFinite(size) && size > 0 ? size : undefined
    })
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (item && typeof item === 'object') push(item as Record<string, unknown>)
    })
  } else if (obj && typeof obj === 'object') {
    const rec = obj as Record<string, unknown>
    if (Array.isArray(rec.files)) {
      rec.files.forEach((item: unknown) => {
        if (item && typeof item === 'object') push(item as Record<string, unknown>)
      })
    } else {
      push(rec)
    }
  }
  return items
}
function getParsedFiles(tc: ToolCallItem): ParsedFileItem[] {
  if (!isFileTool(tc.toolName)) return []
  return parseFileToolResult(tc.toolName, tc.result)
}

function parseAgentToolEventPayload(data: string): AgentToolEventPayload {
  if (!data || typeof data !== 'string') return {}
  const raw = data.trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object') ? (parsed as AgentToolEventPayload) : { content: raw }
  } catch {
    return { content: raw }
  }
}

function getAgentToolName(payload: AgentToolEventPayload): string {
  const direct = payload.toolName
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const metaToolName = payload.meta?.toolName
  return typeof metaToolName === 'string' ? metaToolName.trim() : ''
}

function getAgentToolCallId(payload: AgentToolEventPayload): string | undefined {
  const direct = payload.toolCallId
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const metaToolCallId = payload.meta?.toolCallId
  return typeof metaToolCallId === 'string' && metaToolCallId.trim() ? metaToolCallId.trim() : undefined
}

function getAgentToolContent(payload: AgentToolEventPayload): string {
  if (typeof payload.content === 'string') return payload.content
  if (payload.content != null) {
    try {
      return JSON.stringify(payload.content)
    } catch {
      return String(payload.content)
    }
  }
  return ''
}

function matchesMcpKind(item: ToolCallItem, isMcpResult: boolean): boolean {
  return !!item.isMcp === !!isMcpResult
}

function findPendingToolCallInList(
  tools: ToolCallItem[] | undefined,
  opts: { toolCallId?: string; toolName?: string; isMcpResult: boolean }
): ToolCallItem | undefined {
  if (!tools?.length) return undefined

  if (opts.toolCallId) {
    for (let i = tools.length - 1; i >= 0; i--) {
      const tool = tools[i]
      if (tool.toolCallId === opts.toolCallId && matchesMcpKind(tool, opts.isMcpResult)) {
        return tool
      }
    }
  }

  if (opts.toolName) {
    for (let i = tools.length - 1; i >= 0; i--) {
      const tool = tools[i]
      if (
        tool.result == null &&
        tool.toolName === opts.toolName &&
        matchesMcpKind(tool, opts.isMcpResult)
      ) {
        return tool
      }
    }
  }

  for (let i = tools.length - 1; i >= 0; i--) {
    const tool = tools[i]
    if (tool.result == null && matchesMcpKind(tool, opts.isMcpResult)) {
      return tool
    }
  }

  for (let i = tools.length - 1; i >= 0; i--) {
    const tool = tools[i]
    if (tool.result == null) {
      return tool
    }
  }

  return undefined
}

function findPendingToolCall(
  currentTools: ToolCallItem[] | undefined,
  steps: MessageStep[] | undefined,
  opts: { toolCallId?: string; toolName?: string; isMcpResult: boolean }
): ToolCallItem | undefined {
  const inCurrent = findPendingToolCallInList(currentTools, opts)
  if (inCurrent) return inCurrent
  if (!steps?.length) return undefined

  for (let si = steps.length - 1; si >= 0; si--) {
    const inStep = findPendingToolCallInList(steps[si].tools, opts)
    if (inStep) return inStep
  }

  return undefined
}

// 创建会话 API 返回（与后端 AgentSessionVO 一致；sessionId 用 string 避免精度丢失）
interface AgentSessionVO {
  sessionId: string | number
  title?: string
  lastMessage?: string
  createTime?: string
  updateTime?: string
}

// 路由
const route = useRoute()
const router = useRouter()

function goBack() {
  if (runAbortController) {
    runAbortController.abort()
    runAbortController = null
    isRunning.value = false
  }
  // 返回到智能体首页（AgentHome）
  router.push({ path: '/agent' })
}

// 响应式数据
const messages = ref<Message[]>([])
const copiedMessage = ref<Message | null>(null)
function hasMessageDetails(msg: Message): boolean {
  return msg.tokens != null || msg.promptTokens != null || msg.completionTokens != null ||
    msg.cachedTokens != null || msg.cost != null || msg.runDuration != null || msg.thinkingTime != null
}
async function copyAssistantMessage(msg: Message) {
  if (!msg.content) return
  try {
    await navigator.clipboard.writeText(msg.content)
    copiedMessage.value = msg
    window.setTimeout(() => {
      if (copiedMessage.value === msg) copiedMessage.value = null
    }, 1500)
  } catch {
    warnMessage.value = '复制失败'
  }
}
const currentMessage = reactive<Message>({
  role: 'assistant',
  content: '',
  steps: [],
  attachmentLoading: false,
})
/** 当前流式推理阶段（暂存，step_start/done 时推入当前消息的 steps 中） */
const currentStep = reactive<MessageStep>({
  reasoning: '',
  thinkingTime: undefined,
  tools: []
})
/** 当前 step 的推理开始时间（毫秒） */
let currentStepStartedAt: number | undefined
const userInput = ref('')
const messageInputRef = ref<HTMLTextAreaElement | null>(null)
// 输入框自动增高的最大高度（px）。需要调整最大高度时改这里即可。
const INPUT_MAX_HEIGHT_PX = 150

function autoResizeMessageInput() {
  const el = messageInputRef.value
  if (!el) return

  // 先重置高度，让 scrollHeight 反映真实内容高度（包含换行）
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, 28), INPUT_MAX_HEIGHT_PX)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT_PX ? 'auto' : 'hidden'
}

let resizeRaf = 0
function scheduleAutoResizeMessageInput() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0
    autoResizeMessageInput()
  })
}
// --------- 附件（参考 Chat.vue，简化版） ----------
interface AgentAttachment {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  progress: number
  fileUrl?: string
  attachmentId?: string | number
  error?: string
}
const agentAttachments = ref<AgentAttachment[]>([])
let draftRunId: string | null = null

function createRunId(): string {
  const words = new Uint32Array(2)
  let value = 0n
  do {
    crypto.getRandomValues(words)
    value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
  } while (value === 0n)
  return value.toString()
}
const agentImagePreview = reactive({
  visible: false,
  src: '',
  name: ''
})
const agentFileInput = ref<HTMLInputElement | null>(null)
const agentIsUploading = ref(false)
const hasUnconfirmedAgentAttachments = computed(() =>
  agentAttachments.value.some((a) => a.status === 'uploading')
)
const isRunning = ref(false)
const runNow = ref(Date.now())
let runClock: ReturnType<typeof setInterval> | null = null

function getRunDurationLabel(msg: Message, idx: number): string {
  const live = isRunning.value && idx === messages.value.length - 1 && msg.runStartedAt != null
  const elapsed = live ? runNow.value - msg.runStartedAt! : (msg.cost ?? msg.runDuration ?? msg.thinkingTime ?? (msg.steps || []).reduce((sum, step) => sum + (step.thinkingTime || 0), 0))
  if (!Number.isFinite(elapsed) || elapsed <= 0) return live ? '进行中' : ''
  const seconds = Math.max(1, Math.floor(elapsed / 1000))
  const minutes = Math.floor(seconds / 60)
  const time = minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
  return live ? `进行中 · ${time}` : `用时 ${time}`
}
const errorMessage = ref('')
const warnMessage = ref('')
const messagesLoading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
// 是否自动滚动到底部（用户上滑则暂时关闭自动滚动，回到底部后重新开启）
const autoScrollToBottom = ref(true)
let runAbortController: AbortController | null = null
let currentSessionId: string | null = null
// 从首页「开始智能体」进入的待创建会话：首条消息发送时再调用 createSession 并加入列表，不在此前插入占位
const pendingNewSessionId = ref<string | null>(null)
let creatingAgentSession: Promise<string> | null = null
let startingAgentConversation = false
let skipSessionLoadId: string | null = null

function openAgentImagePreview(src: string, name = '') {
  if (!src) return
  agentImagePreview.visible = true
  agentImagePreview.src = src
  agentImagePreview.name = name
}

function closeAgentImagePreview() {
  agentImagePreview.visible = false
  agentImagePreview.src = ''
  agentImagePreview.name = ''
}

// 听写（ASR）状态与逻辑（参考 Chat.vue）
const isDictating = ref(false)
const dictationTranscript = ref('') // 实时识别结果（含中间结果）
const dictationError = ref('')
const dictationBubbleRef = ref<HTMLElement | null>(null)
let dictationWs: WebSocket | null = null
let dictationStream: MediaStream | null = null
let dictationCtx: AudioContext | null = null
let dictationWorkletNode: AudioWorkletNode | null = null
let dictationSource: MediaStreamAudioSourceNode | null = null

async function startDictation() {
  dictationError.value = ''
  dictationTranscript.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    dictationStream = stream
    const ctx = new AudioContext({ sampleRate: 16000 })
    dictationCtx = ctx

    await ctx.audioWorklet.addModule(
      typeof import.meta.env?.BASE_URL === 'string'
        ? `${import.meta.env.BASE_URL}dictation-processor.js`
        : '/dictation-processor.js'
    )
    const workletNode = new AudioWorkletNode(ctx, 'dictation-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    dictationWorkletNode = workletNode

    const source = ctx.createMediaStreamSource(stream)
    dictationSource = source

    const wsUrl = getAsrWsUrl()
    const ws = new WebSocket(wsUrl)
    dictationWs = ws

    workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (dictationWs?.readyState !== WebSocket.OPEN) return
      const pcm = floatTo16BitPCM(e.data)
      dictationWs.send(pcm)
    }

    ws.onopen = () => {
      isDictating.value = true
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { text?: string; final?: boolean }
        const text = (msg.text ?? '').trim()
        if (!text) return
        if (msg.final) {
          dictationTranscript.value += (dictationTranscript.value.endsWith(' ') ? '' : ' ') + text + ' '
        }
      } catch (_) {}
    }
    ws.onerror = () => {
      dictationError.value = '听写连接异常'
    }
    ws.onclose = () => {
      isDictating.value = false
    }

    source.connect(workletNode)
    workletNode.connect(ctx.destination)
    isDictating.value = true
  } catch (err) {
    const errorName = err instanceof Error ? err.name : ''
    dictationError.value = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
      ? '请允许浏览器使用麦克风后重试'
      : (err instanceof Error ? err.message : '无法访问麦克风')
  }
}

function stopDictation() {
  if (dictationWs) {
    dictationWs.close()
    dictationWs = null
  }
  if (dictationWorkletNode && dictationSource && dictationCtx) {
    dictationWorkletNode.disconnect()
    dictationSource.disconnect()
    dictationWorkletNode = null
    dictationSource = null
  }
  if (dictationCtx) {
    dictationCtx.close().catch(() => {})
    dictationCtx = null
  }
  if (dictationStream) {
    dictationStream.getTracks().forEach((t) => t.stop())
    dictationStream = null
  }
  isDictating.value = false
}

function submitDictationToInput() {
  if (isDictating.value) stopDictation()
  const text = dictationTranscript.value.trim()
  if (text) {
    const cur = userInput.value
    userInput.value = cur ? cur + (cur.endsWith(' ') ? '' : ' ') + text : text
  }
  dictationTranscript.value = ''
  dictationError.value = ''
}

function cancelDictation() {
  if (isDictating.value) stopDictation()
  dictationTranscript.value = ''
  dictationError.value = ''
}

/** 一键切换录音：开始 / 停止（ChatGPT 风格） */
function toggleDictation() {
  if (isRunning.value) return
  if (isDictating.value) {
    stopDictation()
  } else {
    startDictation()
  }
}

watch(dictationTranscript, () => {
  nextTick(() => {
    const el = dictationBubbleRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

// 从路由获取 sessionId（后端为 Long/bigint，前端用 string 避免精度丢失）
const sessionIdFromRoute = computed(() => {
  const id = route.query.sessionId
  return (id != null && id !== '') ? String(id) : null
})

// 生成 bigint 类型的 SessionId（以字符串形式传递，避免 JS Number 精度问题）
function generateSessionId(): string {
  const t = BigInt(Date.now()) * 1000000n
  const r = BigInt(Math.floor(Math.random() * 1000000))
  return (t + r).toString()
}

// 是否展示首页（无 sessionId 时）
const showHome = computed(() => !sessionIdFromRoute.value)

// 右侧栏会话列表（id 全程用 string，避免 bigint 精度丢失）
const agentSessions = ref<Array<{ id: string; title?: string; lastMessage?: string; updateTime?: number }>>([])
const agentSessionsLoading = ref(false)

function upsertLocalAgentSession(session: {
  id: string
  title?: string
  lastMessage?: string
  updateTime?: number
}) {
  const next = {
    ...session,
    updateTime: session.updateTime ?? Date.now()
  }
  const idx = agentSessions.value.findIndex((s) => s.id === next.id)
  if (idx >= 0) {
    const old = agentSessions.value[idx]
    agentSessions.value.splice(idx, 1)
    agentSessions.value.unshift({
      ...old,
      ...next
    })
  } else {
    agentSessions.value.unshift(next)
  }
  window.dispatchEvent(
    new CustomEvent('agent:new-conversation', {
      detail: {
        id: next.id,
        title: next.title,
        lastMessage: next.lastMessage,
        updateTime: next.updateTime
      }
    })
  )
}

async function loadAgentSessions() {
  agentSessionsLoading.value = true
  try {
    const res = await apiFetch<any[]>('/api/agent/sessions', {
      credentials: 'include' 
    })
    if (!res.ok || !('json' in res)) return
    const json = res.json
    if (json?.code === 200 && Array.isArray(json.data)) {
      agentSessions.value = (json.data as any[]).map((s: any) => ({
        id: String(s.sessionId),
        title: s.title,
        lastMessage: s.lastMessage,
        updateTime: s.updateTime
      }))
    }
  } finally {
    agentSessionsLoading.value = false
  }
}

function openAgentSession(sessionId: string) {
  router.push({ path: '/agent', query: { sessionId } })
}

async function handleStartConversation() {
  if (startingAgentConversation) return
  startingAgentConversation = true
  errorMessage.value = ''
  const provisionalId = generateSessionId()
  currentSessionId = provisionalId
  pendingNewSessionId.value = provisionalId
  upsertLocalAgentSession({ id: provisionalId, title: '新任务', lastMessage: '' })
  try {
    // 先进入新会话页面，再在后台创建；占位 ID 会被路由监听器识别并跳过历史查询。
    await router.replace({ path: '/agent', query: { sessionId: provisionalId } })
    void ensureAgentSession('新任务').catch((error) => {
      errorMessage.value = error instanceof Error ? error.message : '创建会话失败'
    })
  } catch (error) {
    currentSessionId = null
    pendingNewSessionId.value = null
    errorMessage.value = error instanceof Error ? error.message : '打开会话失败'
  } finally {
    startingAgentConversation = false
  }
}

// 触发附件选择
function triggerAgentFileSelect() {
  agentFileInput.value?.click()
}

async function addAgentFile(file: File) {
  if (!file) return
  // 未登录禁止上传附件
  if (!isLoggedIn()) {
    warnMessage.value = '请先登录后再上传附件'
    setTimeout(() => (warnMessage.value = ''), 3000)
    return
  }
  if (agentAttachments.value.length >= 2) {
    warnMessage.value = '最多只能上传 2 个附件'
    setTimeout(() => (warnMessage.value = ''), 3000)
    return
  }
  if (!isAllowedVideoFormat(file)) {
    warnMessage.value = '视频仅支持 mp4 / mkv / mov 格式'
    setTimeout(() => (warnMessage.value = ''), 3000)
    return
  }
  if (!currentSessionId && !sessionIdFromRoute.value) await handleStartConversation()
  const sessionId = currentSessionId ?? sessionIdFromRoute.value
  if (!sessionId) {
    warnMessage.value = '请先开始会话再上传附件'
    setTimeout(() => (warnMessage.value = ''), 3000)
    return
  }
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const item: AgentAttachment = {
    id,
    file,
    status: 'uploading',
    progress: 0
  }
  agentAttachments.value.push(item)
  agentIsUploading.value = true
  try {
    // confirm 必须使用已创建会话的 ID，不能使用首页生成的本地占位 ID。
    const confirmedSessionId = await ensureAgentSession(userInput.value.trim() || '新任务')
    const compressed = await compressMediaAttachment(file)
    // 压缩期间用户可能删除了该附件，删除后不再继续上传
    const stillExists = agentAttachments.value.some((a) => a.id === id)
    if (!stillExists) return

    const fileToUpload = compressed.file
    const uploadSize = typeof fileToUpload.size === 'number' ? fileToUpload.size : 0
    const fileName = compressed.fileName ?? file.name ?? ''
    const fileType = compressed.fileType ?? file.type ?? ''
    const runId = draftRunId ?? (draftRunId = createRunId())
    const { fileUrl, attachmentId } = await uploadFile(fileToUpload, {
      conservation_id: confirmedSessionId,
      runId,
      fileSize: uploadSize,
      fileName,
      fileType
    })
    const idx = agentAttachments.value.findIndex((a) => a.id === id)
    if (idx !== -1) {
      agentAttachments.value[idx] = {
        ...agentAttachments.value[idx],
        status: 'done',
        progress: 100,
        fileUrl,
        attachmentId: attachmentId ?? agentAttachments.value[idx].attachmentId
      }
    }
  } catch (e: any) {
    const idx = agentAttachments.value.findIndex((a) => a.id === id)
    if (idx !== -1) {
      agentAttachments.value[idx] = {
        ...agentAttachments.value[idx],
        status: 'error',
        error: String(e?.message || '上传失败'),
        progress: 0
      }
    }
  } finally {
    agentIsUploading.value = false
  }
}

// 处理文件选择
async function handleAgentFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target?.files?.length) return
  for (let i = 0; i < target.files.length && agentAttachments.value.length < 2; i++) {
    await addAgentFile(target.files[i])
  }
  target.value = ''
}

// 删除附件
function removeAgentAttachment(id: string) {
  agentAttachments.value = agentAttachments.value.filter((a) => a.id !== id)
}

function getAgentFileExt(fileName: string): string {
  const name = String(fileName || '')
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot >= name.length - 1) return 'FILE'
  return name.slice(dot + 1).toUpperCase().slice(0, 4)
}

function isAgentTextLikeFile(fileName: string, fileType: string): boolean {
  const type = String(fileType || '').toLowerCase()
  if (type.startsWith('text/')) return true
  const ext = getAgentFileExt(fileName).toLowerCase()
  return ['csv', 'txt', 'md', 'json', 'xml', 'yml', 'yaml', 'log'].includes(ext)
}

// 已废弃的基于 stepIndex / reasoningBlocks 的逻辑移除

// 流式与历史消息使用同一套 Markdown 渲染规则。
function getAssistantMessageHtml(msg: Message): string {
  const text = msg.content || ''
  if (!text) return ''
  return decorateGeneratedDownloads(transformMarkdownForStream(text, { appendCursor: false, allowEmpty: true }))
}

function renderStepText(content: string): string {
  return decorateGeneratedDownloads(transformMarkdownForStream(content))
}

const POSSIBLE_FILE_URL = /https?:\/\/[^\s<>"')\]]+/g
function isGeneratedFileUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname.endsWith('.myqcloud.com') &&
      url.pathname.includes('/generate/')
  } catch {
    return false
  }
}
function decorateGeneratedDownloads(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  const makeCard = (url: string): HTMLAnchorElement => {
    const card = document.createElement('a')
    let fileName = new URL(url).pathname.split('/').pop() || '下载文件'
    try { fileName = decodeURIComponent(fileName) } catch { /* 流式 URL 可能尚未传完 */ }
    card.className = 'agent-download-card'
    card.href = url
    card.target = '_blank'
    card.rel = 'noopener noreferrer'
    card.download = fileName
    card.title = fileName
    const icon = document.createElement('span')
    icon.className = 'agent-download-icon'
    icon.innerHTML = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" fill="currentColor" opacity=".12"/><path d="M18 3.5v6a2 2 0 0 0 2 2h5M8 3.5h10l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-22a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 18h10M11 22h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    const info = document.createElement('span')
    info.className = 'agent-download-info'
    const label = document.createElement('span')
    label.className = 'agent-download-name'
    label.textContent = fileName
    const meta = document.createElement('span')
    meta.className = 'agent-download-meta'
    const extension = fileName.split('.').pop()?.toUpperCase()
    meta.textContent = extension && extension !== fileName.toUpperCase() ? `${extension} 文件` : '文件'
    info.append(label, meta)
    const action = document.createElement('span')
    action.className = 'agent-download-action'
    action.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    card.append(icon, info, action)
    return card
  }
  container.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || ''
    if (isGeneratedFileUrl(href)) link.replaceWith(document.createElement('br'), makeCard(href), document.createElement('br'))
  })
  container.querySelectorAll('code').forEach((code) => {
    if (code.closest('pre')) return
    const url = code.textContent?.trim() || ''
    if (isGeneratedFileUrl(url)) code.replaceWith(document.createElement('br'), makeCard(url), document.createElement('br'))
  })
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('a, code, pre')) continue
    if (node.textContent?.includes('myqcloud.com')) nodes.push(node)
  }
  nodes.forEach((node) => {
    const value = node.textContent || ''
    const fragment = document.createDocumentFragment()
    let start = 0
    for (const match of value.matchAll(POSSIBLE_FILE_URL)) {
      const url = match[0].replace(/[.,;!?]+$/, '')
      if (!isGeneratedFileUrl(url)) continue
      const index = match.index ?? 0
      if (index > start) fragment.append(document.createTextNode(value.slice(start, index)))
      fragment.append(document.createElement('br'), makeCard(url), document.createElement('br'))
      start = index + url.length
    }
    if (start === 0) return
    if (start < value.length) fragment.append(document.createTextNode(value.slice(start)))
    node.replaceWith(fragment)
  })
  return container.innerHTML
}

// JSON 格式化
function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// 滚动到底部
function scrollToBottom(force = false) {
  nextTick(() => {
    const el = messagesContainer.value
    if (!el) return
    // 当用户手动上滑时，不再自动滚动；强制滚动时忽略该开关
    if (!force && !autoScrollToBottom.value) return
    el.scrollTop = el.scrollHeight
  })
}

// 监听消息列表滚动，判断用户是否上滑离开底部区域
function handleMessagesScroll() {
  const el = messagesContainer.value
  if (!el) return
  const distanceToBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
  const THRESHOLD = 60 // 距离底部 60px 内都认为在“底部”
  // 只要离开底部阈值，就认为用户在浏览历史，关闭自动滚动
  autoScrollToBottom.value = distanceToBottom <= THRESHOLD
}

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 创建会话：使用传入的 SessionId；若未传则内部生成一个
async function createSession(message: string, sessionId?: string): Promise<string> {
  const sid = sessionId ?? generateSessionId()
  const response = await apiFetch<AgentSessionVO>('/api/agent/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, SessionId: sid }),
    credentials: 'include'
  })

  if (!response.ok || !('json' in response)) {
    throw new Error('创建会话失败')
  }

  const result = response.json as { code: number; message?: string; data?: AgentSessionVO }
  if (result.code !== 200 || result.data?.sessionId == null) {
    throw new Error(result.message || '创建会话失败')
  }

  // 通知右侧会话列表刷新
  window.dispatchEvent(new CustomEvent('agent-sessions:updated'))

  // 返回最终使用的 sessionId（后端可能会回传同一个 Long）
  return String(result.data.sessionId ?? sid)
}

async function ensureAgentSession(message: string): Promise<string> {
  if (!currentSessionId) {
    currentSessionId = generateSessionId()
    pendingNewSessionId.value = currentSessionId
  }
  if (pendingNewSessionId.value !== currentSessionId) return currentSessionId
  if (!creatingAgentSession) {
    const provisionalId = currentSessionId
    creatingAgentSession = (async () => {
      const confirmedId = await createSession(message, provisionalId)
      if (currentSessionId === provisionalId) {
        currentSessionId = confirmedId
        pendingNewSessionId.value = null
        upsertLocalAgentSession({ id: confirmedId, title: message, lastMessage: message })
        if (confirmedId !== provisionalId) {
          agentSessions.value = agentSessions.value.filter((s) => s.id !== provisionalId)
          skipSessionLoadId = confirmedId
          await router.replace({ path: '/agent', query: { sessionId: confirmedId } })
        }
      }
      return confirmedId
    })().finally(() => { creatingAgentSession = null })
  }
  return creatingAgentSession
}

// 安全地将任意值转为有限数字（无效或缺失时返回 undefined）
function toFiniteNumber(v: any): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'string' && v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseUsageStats(...candidates: any[]): UsageStats {
  const containers: Record<string, any>[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const obj = candidate as Record<string, any>
    containers.push(obj)
    if (obj.usage && typeof obj.usage === 'object') containers.push(obj.usage)
    if (obj.stats && typeof obj.stats === 'object') containers.push(obj.stats)
    if (obj.meta && typeof obj.meta === 'object') containers.push(obj.meta)
  }

  const pick = (...keys: string[]) => {
    for (const container of containers) {
      for (const key of keys) {
        const value = toFiniteNumber(container[key])
        if (value != null) return value
      }
    }
    return undefined
  }

  return {
    thinkingTime: pick('thinkingTime', 'thinking_time'),
    promptTokens: pick('promptTokens', 'prompt_tokens'),
    completionTokens: pick('completionTokens', 'completion_tokens'),
    cachedTokens: pick('cachedTokens', 'cached_tokens'),
    cost: pick('cost'),
    tokens: pick('tokens', 'token')
  }
}

function addUsageStats(target: Message, stats: UsageStats) {
  if (stats.thinkingTime != null) target.thinkingTime = (target.thinkingTime ?? 0) + stats.thinkingTime
  if (stats.promptTokens != null) target.promptTokens = (target.promptTokens ?? 0) + stats.promptTokens
  if (stats.completionTokens != null) target.completionTokens = (target.completionTokens ?? 0) + stats.completionTokens
  if (stats.cachedTokens != null) target.cachedTokens = (target.cachedTokens ?? 0) + stats.cachedTokens
  if (stats.cost != null) target.cost = (target.cost ?? 0) + stats.cost
  if (stats.tokens != null) target.tokens = (target.tokens ?? 0) + stats.tokens
}

/** 从 SSE data 中解析出要拼接的文本。兼容 JSON：{"type":"reasoning"|"text","content":"..."}，只返回 content；
 * 若同一段 data 内有多段 JSON 首尾相连，则逐段解析并拼接所有 content */
function parseStreamContent(data: string, expectedType: 'reasoning' | 'text'): string {
  if (!data || typeof data !== 'string') return ''
  const s = data.trim()
  if (!s) return ''
  const parts: string[] = []
  // 尝试按 }\s*{ 拆成多段，兼容后端一次推送多段 JSON 的情况
  const chunks = s.split(/\}\s*\{/)
  for (let i = 0; i < chunks.length; i++) {
    const jsonStr = i === 0
      ? chunks[0] + (chunks.length > 1 ? '}' : '')
      : chunks[i]
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed && typeof parsed === 'object' && parsed.type === expectedType && 'content' in parsed) {
        parts.push(String(parsed.content ?? ''))
        continue
      }
    } catch {
      // 当前段不是合法 JSON，忽略
    }
    // 若只有一段且无法解析为预期 JSON，整段当作纯文本（兼容非 JSON 流）
    if (chunks.length === 1) return s
  }
  return parts.join('')
}

// 发送消息
async function handleSend() {
  const text = userInput.value.trim()
  if (!text || isRunning.value || hasUnconfirmedAgentAttachments.value) return
  if (!currentSessionId && !sessionIdFromRoute.value) await handleStartConversation()
  if (!currentSessionId) return

  // 发送时若正在语音输入，先停掉，避免占用麦克风与 UI 状态冲突
  if (isDictating.value) {
    stopDictation()
    dictationTranscript.value = ''
    dictationError.value = ''
  }

  // 添加用户消息
  const runId = draftRunId ?? (draftRunId = createRunId())
  const submittedAttachments = agentAttachments.value
    .filter((a) => a.status === 'done' && a.attachmentId != null && a.fileUrl)
    .map((a): AgentAttachmentVO => ({
      id: String(a.attachmentId),
      fileName: a.file.name,
      fileUrl: a.fileUrl!,
      fileSize: a.file.size,
      fileType: a.file.type
    }))
  messages.value.push({ role: 'user', content: text, runId, attachments: submittedAttachments })
  userInput.value = ''
  await nextTick()
  scheduleAutoResizeMessageInput()
  scrollToBottom()

  // 重置状态
  currentMessage.role = 'assistant'
  currentMessage.content = ''
  currentMessage.thinkingTime = undefined
  currentMessage.attachmentLoading = false
  currentMessage.steps = []
  currentStep.reasoning = ''
  currentStep.tools = []
  currentStep.thinkingTime = undefined
  currentStepStartedAt = undefined
  errorMessage.value = ''
  warnMessage.value = ''
  isRunning.value = true

  try {
    // 如果还没有会话 ID，则本地先生成一个；创建失败时保留待创建标记供重试
    currentSessionId = await ensureAgentSession(text)
    // 确认会话已创建，再提交 /run；后端会校验会话所有权
    // POST + SSE 流，请求体为 AgentSendReq，已登录时请求头携带 Authorization
    const url = '/api/agent/run'
    const token = getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token) headers['Authorization'] = token

    // 收集已完成的附件 id 传给后端
    const doneAttachments = agentAttachments.value.filter(
      (a) => a.status === 'done' && a.attachmentId != null && a.fileUrl
    )
    const attachmentIds = doneAttachments.map((a) => String(a.attachmentId))

    const body: Record<string, unknown> = {
      sessionId: currentSessionId,
      runId,
      token: token,
      message: text,
      attachments: attachmentIds
    }
    if (token) body.token = token

    runAbortController = new AbortController()
    const res = await apiFetchRaw(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
      signal: runAbortController.signal
    })
    if (!res.ok || !res.body) {
      errorMessage.value = res.statusText || '请求失败'
      isRunning.value = false
      return
    }
    // 服务端已接收本轮及附件后，清空输入区附件卡片；失败响应则保留附件供用户处理。
    const submittedAttachmentIds = new Set(doneAttachments.map((attachment) => attachment.id))
    agentAttachments.value = agentAttachments.value.filter(
      (attachment) => !submittedAttachmentIds.has(attachment.id)
    )
    if (draftRunId === runId) draftRunId = null
    // 先插入一条当前助手消息，便于流式更新推理和正文（流式渲染）
    messages.value.push({
      role: 'assistant',
      runId,
      content: '',
      steps: [],
      attachmentLoading: false,
      thinkingExpanded: true,
      thinkingTime: undefined,
      runStartedAt: Date.now()
    })
    runNow.value = Date.now()
    if (runClock) clearInterval(runClock)
    runClock = setInterval(() => { runNow.value = Date.now() }, 1000)
    // 辅助函数：将当前 step 推入当前消息的 steps 列表（用于 step_start / done）
    const pushCurrentStepIfNeeded = () => {
      const hasReasoning = !!(currentStep.reasoning && currentStep.reasoning.trim())
      const hasContent = !!(currentStep.content && currentStep.content.trim())
      const hasTools = !!(currentStep.tools && currentStep.tools.length)
      if (!hasReasoning && !hasContent && !hasTools) {
        currentStepStartedAt = undefined
        return
      }
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now()
      const stepTime =
        currentStepStartedAt != null
          ? Math.max(0, Math.round(now - currentStepStartedAt))
          : currentStep.thinkingTime
      const step: MessageStep = {
        reasoning: currentStep.reasoning,
        content: currentStep.content,
        thinkingTime: stepTime,
        tools: currentStep.tools ? [...currentStep.tools] : []
      }
      if (!currentMessage.steps) currentMessage.steps = []
      currentMessage.steps.push(step)
      // 重置临时 step
      currentStep.reasoning = ''
      currentStep.content = ''
      currentStep.tools = []
      currentStep.thinkingTime = undefined
      currentStepStartedAt = undefined
    }

    const movePendingTextToStep = () => {
      if (!currentMessage.content) return
      currentStep.content = (currentStep.content || '') + currentMessage.content
      currentMessage.content = ''
    }

    const updateLastAssistantFromCurrent = () => {
      const last = messages.value[messages.value.length - 1]
      if (last?.role === 'assistant') {
        messages.value[messages.value.length - 1] = {
          ...last,
          content: currentMessage.content,
          attachmentLoading: currentMessage.attachmentLoading,
          steps: currentMessage.steps ? [...currentMessage.steps] : []
        }
      }
    }

    let terminalEventReceived = false
    const dispatch = (event: string, data: string) => {
      try {
        const parsed = JSON.parse(data)
        const eventRunId = parsed?.meta?.runId
        if (eventRunId != null && String(eventRunId) !== runId) return
      } catch {
        // 兼容旧版非 JSON SSE 数据。
      }
      switch (event) {
        case 'attachment_loading': {
          currentMessage.attachmentLoading = true
          updateLastAssistantFromCurrent()
          scrollToBottom()
          break
        }
        case 'attachment_loaded': {
          currentMessage.attachmentLoading = false
          updateLastAssistantFromCurrent()
          scrollToBottom()
          break
        }
        case 'reasoning': {
          const reasoningChunk = parseStreamContent(data, 'reasoning')
          if (reasoningChunk) {
            // 开始新的推理阶段计时
            if (currentStepStartedAt == null) {
              const now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now()
              currentStepStartedAt = now
            }
            currentStep.reasoning = (currentStep.reasoning || '') + reasoningChunk
            // 更新当前 step 的耗时（用于流式“正在思考”展示）
            if (currentStepStartedAt != null) {
              const now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now()
              currentStep.thinkingTime = Math.max(0, Math.round(now - currentStepStartedAt))
            }
          }
          if (reasoningChunk) currentMessage.attachmentLoading = false
          updateLastAssistantFromCurrent()
          scrollToBottom()
          break
        }
        case 'text': {
          // 兼容 JSON 格式 {"type":"text","content":"..."}，只拼接 content 文本
          const textChunk = parseStreamContent(data, 'text')
          if (textChunk) currentMessage.attachmentLoading = false
          currentMessage.content += textChunk
          updateLastAssistantFromCurrent()
          scrollToBottom()
          break
        }
        case 'step_start': {
          // 阶段切换：将当前 step 推入 steps，后续 reasoning / 工具归入新的 step
          currentMessage.attachmentLoading = false
          movePendingTextToStep()
          pushCurrentStepIfNeeded()
          updateLastAssistantFromCurrent()
          scrollToBottom()
          break
        }
        case 'tool_call':
        case 'mcp_call': {
          try {
            const payload = parseAgentToolEventPayload(data)
            const toolName = getAgentToolName(payload) || 'unknown'
            const args = getAgentToolContent(payload)
            const toolCallId = getAgentToolCallId(payload)
            const isMcp = event === 'mcp_call' || isMcpToolName(toolName)
            if (!currentStep.tools) currentStep.tools = []
            currentMessage.attachmentLoading = false
            movePendingTextToStep()
            currentStep.tools.push({ toolCallId, toolName, args, result: null, isMcp })
            updateLastAssistantFromCurrent()
          } catch (e) {
            console.warn(`${event} parse error`, e)
          }
          break
        }
        case 'tool_result':
        case 'mcp_result': {
          try {
            const payload = parseAgentToolEventPayload(data)
            const content = getAgentToolContent(payload)
            const toolName = getAgentToolName(payload)
            const toolCallId = getAgentToolCallId(payload)
            const isMcpResult = event === 'mcp_result' || isMcpToolName(toolName)
            const target = findPendingToolCall(currentStep.tools, currentMessage.steps, {
              toolCallId,
              toolName,
              isMcpResult
            })
            if (target) {
              currentMessage.attachmentLoading = false
              target.result = content
              const displayResult = payload.displayResult ?? payload.meta?.displayResult
              if (typeof displayResult === 'string') target.displayResult = displayResult
              const displayFormat = payload.displayFormat ?? payload.meta?.displayFormat
              if (typeof displayFormat === 'string') target.displayFormat = displayFormat
              const language = payload.language ?? payload.meta?.language
              if (typeof language === 'string') target.language = language
              if (isMcpResult) target.isMcp = true
              if (toolCallId && !target.toolCallId) target.toolCallId = toolCallId
              // 从 tool_result 的 meta 中提取 cost（耗时，毫秒）
              const meta = payload.meta ?? {}
              const cost = toFiniteNumber(meta.cost ?? payload.cost)
              if (cost != null) target.cost = cost
              updateLastAssistantFromCurrent()
            }
          } catch (e) {
            console.warn(`${event} parse error`, e)
          }
          break
        }
        case 'warn':
          warnMessage.value = data
          setTimeout(() => (warnMessage.value = ''), 5000)
          break
        case 'error':
          terminalEventReceived = true
          currentMessage.attachmentLoading = false
          errorMessage.value = data || '发生错误'
          closeEventSource()
          // 若当前助手条无内容，移除占位条
          const errLast = messages.value[messages.value.length - 1]
          const errHasSteps = (errLast?.steps?.length ?? 0) > 0
          if (errLast?.role === 'assistant' && !errLast.content && !errHasSteps) {
            messages.value.pop()
          }
          break
        case 'done': {
          terminalEventReceived = true
          // 解析 usage 统计数据（thinkingTime / promptTokens / completionTokens / cachedTokens / cost / tokens）
          let stats: any = null
          if (data) {
            try {
              stats = JSON.parse(data)
            } catch {
              stats = null
            }
          }

          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg?.role === 'assistant') {
            currentMessage.attachmentLoading = false
            if (stats && typeof stats === 'object') {
              const usage = parseUsageStats(stats)
              addUsageStats(lastMsg, usage)
              currentMessage.thinkingTime = lastMsg.thinkingTime
            }

            // 将当前未结束的 step 推入 steps
            pushCurrentStepIfNeeded()
            lastMsg.content = currentMessage.content
            lastMsg.attachmentLoading = false
            lastMsg.steps = currentMessage.steps ? [...currentMessage.steps] : []
          }
          const hasAnySteps = lastMsg?.role === 'assistant' && ((lastMsg.steps?.length ?? 0) > 0)
          if (lastMsg?.role === 'assistant' && !lastMsg.content && !hasAnySteps) {
            messages.value.pop()
          }
          // 本轮结束后重置临时状态，下一轮重新开始
          currentMessage.content = ''
          currentMessage.attachmentLoading = false
          currentMessage.steps = []
          currentStep.reasoning = ''
          currentStep.content = ''
          currentStep.tools = []
          currentStep.thinkingTime = undefined
          currentStepStartedAt = undefined
          closeEventSource()
          scrollToBottom()
          window.dispatchEvent(new CustomEvent('agent-sessions:updated'))
          break
        }
        case 'cancelled':
          terminalEventReceived = true
          warnMessage.value = '任务已取消'
          closeEventSource()
          break
      }
    }

    let buf = ''
    let eventType = ''
    let dataLines: string[] = []
    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split(/\n/)
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5))
          } else if (line === '') {
            if (eventType && dataLines.length) {
              const data = dataLines.join('\n').trim()
              dispatch(eventType, data)
            }
            eventType = ''
            dataLines = []
          }
        }
      }
      if (eventType && dataLines.length) {
        dispatch(eventType, dataLines.join('\n').trim())
      }
      if (isRunning.value && !terminalEventReceived) {
        errorMessage.value = '连接中断，任务状态尚未确认'
        closeEventSource()
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && isRunning.value) {
        errorMessage.value = '连接中断，任务状态尚未确认'
      }
      closeEventSource()
    }

  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发送失败'
    closeEventSource()
  }
}

watch(
  userInput,
  () => {
    scheduleAutoResizeMessageInput()
  },
  { flush: 'post' }
)

onMounted(() => {
  scheduleAutoResizeMessageInput()
})

// 停止运行
async function handleStop() {
  if (!currentSessionId) return
  try {
    const response = await apiFetch(`/api/agent/cancel?sessionId=${encodeURIComponent(currentSessionId)}`, {
      method: 'POST',
      credentials: 'include'
    })
    if (!response.ok) throw new Error('取消任务失败')
    warnMessage.value = '正在取消任务'
  } catch (error) {
    console.error('取消失败:', error)
    errorMessage.value = '取消任务失败，请重试'
  }
}

// 关闭 SSE 连接（中止 fetch 流）
function closeEventSource() {
  currentMessage.attachmentLoading = false
  const last = messages.value[messages.value.length - 1]
  if (last?.role === 'assistant' && last.runStartedAt != null && last.runDuration == null) {
    last.runDuration = Math.max(0, Date.now() - last.runStartedAt)
  }
  if (runClock) {
    clearInterval(runClock)
    runClock = null
  }
  if (last?.role === 'assistant' && last.attachmentLoading) {
    last.attachmentLoading = false
  }
  if (runAbortController) {
    runAbortController.abort()
    runAbortController = null
  }
  isRunning.value = false
}

// 加载历史消息（后端 AgentMessageVO: type=user|assistant|tool|tool_result，payload 为 AgentMessagePayload JSON）
// 目标：还原“一整轮助手回复”的结构：step0(reasoning + tools) → step1(reasoning + tools) → ... → 正文
async function loadMessages(sessionId: string) {
  messagesLoading.value = true
  try {
    const response = await apiFetch<AgentMessagesVO>(`/api/agent/messages?sessionId=${sessionId}`, {
      credentials: 'include'
    })

    if (!response.ok || !('json' in response)) {
      messagesLoading.value = false
      return
    }

    const result = response.json
    if (result.code === 200 && Array.isArray(result.data?.messages)) {
      const history: Message[] = []
      const attachmentsByRunId: Record<string, AgentAttachmentVO[]> = result.data.attachmentsByRunId ?? {}

      const parsePayload = (payload: unknown): AgentMessagePayload => {
        if (!payload) return {}
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload) as AgentMessagePayload
          } catch {
            // 兜底：当作纯文本 content
            return { content: payload }
          }
        }
        return payload as AgentMessagePayload
      }

      // 当前正在还原的一轮助手回复
      let currentAssistant: Message | null = null
      let currentRunId: string | null = null
      let currentSteps: MessageStep[] = []
      let currentStepForHistory: MessageStep | null = null

      const pushCurrentStepHistory = () => {
        if (!currentStepForHistory) return
        const hasReasoning = !!(currentStepForHistory.reasoning && currentStepForHistory.reasoning.trim())
        const hasContent = !!(currentStepForHistory.content && currentStepForHistory.content.trim())
        const hasTools = !!(currentStepForHistory.tools && currentStepForHistory.tools.length)
        if (!hasReasoning && !hasContent && !hasTools) return
        currentSteps.push({
          reasoning: currentStepForHistory.reasoning,
          content: currentStepForHistory.content,
          thinkingTime: currentStepForHistory.thinkingTime,
          tools: currentStepForHistory.tools ? [...currentStepForHistory.tools] : []
        })
        currentStepForHistory = null
      }

      const moveHistoryTextToStep = () => {
        if (!currentAssistant?.content) return
        if (!currentStepForHistory) currentStepForHistory = { tools: [] }
        currentStepForHistory.content = (currentStepForHistory.content || '') + currentAssistant.content
        currentAssistant.content = ''
      }

      const finishCurrentAssistant = () => {
        if (!currentAssistant) return
        pushCurrentStepHistory()
        currentAssistant.steps = currentSteps.length ? currentSteps : undefined
        history.push(currentAssistant)
        currentAssistant = null
        currentSteps = []
        currentStepForHistory = null
      }

      for (const raw of result.data.messages) {
        const type: string = raw.type
        const rawRunId = raw.runId == null ? null : String(raw.runId)
        const payload: AgentMessagePayload = parsePayload(raw.payload)

        // runId 明确变化时收尾上一轮，确保一轮的 assistant/tool 数据不跨轮合并。
        if (rawRunId && currentRunId && rawRunId !== currentRunId) finishCurrentAssistant()
        if (rawRunId) currentRunId = rawRunId

        if (type === 'user') {
          // 一轮助手结束，先收尾
          finishCurrentAssistant()
          history.push({
            id: raw.id == null ? undefined : String(raw.id),
            runId: rawRunId,
            role: 'user',
            content: payload.content || '',
            attachments: rawRunId ? (attachmentsByRunId[rawRunId] ?? []) : [],
          })
          continue
        }

        if (type === 'assistant') {
          const content = payload.content || ''
          const reasoning = payload.reasoning || ''

          // 每遇到一条 assistant，都开启一个新的 step
          if (!currentAssistant) {
            currentAssistant = {
              id: raw.id == null ? undefined : String(raw.id),
              runId: rawRunId,
              role: 'assistant',
              content: '',
            }
            currentSteps = []
            currentStepForHistory = null
          } else {
            // 之前的 step 收尾，开启新 step
            moveHistoryTextToStep()
            pushCurrentStepHistory()
          }

          currentStepForHistory = {
            reasoning: reasoning || undefined,
            tools: []
          }

          // 合并 assistant 的正文内容到当前轮次
          currentAssistant.content += content

          // 绑定统计字段：assistant 轮次累计 + 当前 step 的 thinkingTime
          const usage = parseUsageStats(raw, payload)
          if (usage.thinkingTime != null && currentStepForHistory) {
            currentStepForHistory.thinkingTime = usage.thinkingTime
          }
          addUsageStats(currentAssistant, usage)

          continue
        }

        if (type === 'tool' || type === 'mcp_call') {
          if (!currentAssistant) {
            // 没有 assistant 容器时跳过，避免结构错乱
            continue
          }
          if (!currentStepForHistory) {
            currentStepForHistory = { tools: [] }
          }
          if (!currentStepForHistory.tools) currentStepForHistory.tools = []
          moveHistoryTextToStep()
          const toolName = payload.toolName || (payload.meta?.toolName as string) || 'unknown'
          const isMcp = type === 'mcp_call' || isMcpToolName(toolName)
          currentStepForHistory.tools.push({
            toolCallId: payload.toolCallId || undefined,
            toolName,
            args: payload.toolArgs || '',
            result: null,
            isMcp,
            cost: undefined
          })
          continue
        }

        if (type === 'tool_result' || type === 'mcp_result') {
          if (!currentAssistant || !currentStepForHistory || !currentStepForHistory.tools?.length) continue
          const id = payload.toolCallId
          const resultToolName = payload.toolName || (payload.meta?.toolName as string) || ''
          const isMcpResult = type === 'mcp_result' || isMcpToolName(resultToolName)
          const target = findPendingToolCallInList(currentStepForHistory.tools, {
            toolCallId: id || undefined,
            toolName: resultToolName || undefined,
            isMcpResult
          })

          if (target) {
            target.result = payload.toolResult ?? ''
            const displayResult = payload.displayResult ?? payload.meta?.displayResult
            if (typeof displayResult === 'string') target.displayResult = displayResult
            const displayFormat = payload.displayFormat ?? payload.meta?.displayFormat
            if (typeof displayFormat === 'string') target.displayFormat = displayFormat
            const language = payload.language ?? payload.meta?.language
            if (typeof language === 'string') target.language = language
            if (isMcpResult) target.isMcp = true
            const toolCost = toFiniteNumber(payload.cost ?? (raw as any).cost)
            if (toolCost != null) target.cost = toolCost
          }
          continue
        }
      }

      // 文件尾还有一轮助手未收尾
      finishCurrentAssistant()

      messages.value = history
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载历史消息失败:', error)
  } finally {
    messagesLoading.value = false
  }
}

// 监听路由 sessionId：点击侧边栏智能体 session-item 时拉取该会话消息并渲染
watch(
  sessionIdFromRoute,
  (newId) => {
    currentSessionId = newId
    // 首页进入的新会话先使用本地占位 ID；后端创建完成前不能查询历史消息。
    const isPendingSession = !!newId && newId === pendingNewSessionId.value
    // 切换到其他会话时清除「待创建」标记，避免误走首条消息创建逻辑
    if (newId && !isPendingSession) {
      pendingNewSessionId.value = null
    }
    if (newId && newId === skipSessionLoadId) {
      skipSessionLoadId = null
    } else if (isPendingSession) {
      messages.value = []
    } else if (newId) {
      loadMessages(newId)
    } else {
      messages.value = []
    }
  },
  { immediate: true }
)

// 生命周期
onMounted(() => {
  if (route.path === '/agent') loadAgentSessions()
  window.addEventListener('agent-sessions:updated', loadAgentSessions)
})
onBeforeUnmount(() => {
  closeEventSource()
  stopDictation()
  window.removeEventListener('agent-sessions:updated', loadAgentSessions)
})
</script>

<style scoped>
/* 首页与会话共用安静、宽松的输入界面。 */
.agent-container .agent-chat { background: #fafafa; }
.agent-container .agent-chat-home { justify-content: center; padding-bottom: 14vh; }
.agent-container .input-container { border-top: 0; background: transparent; padding: 18px 28px 26px; }
.agent-container .input-box-container {
  grid-template-columns: 32px minmax(0, 1fr) auto;
  grid-template-areas: "add primary trailing";
  align-items: center;
  width: 100%; max-width: 820px; margin: 0 auto;
  min-height: 58px; padding: 8px 10px 8px 14px;
  border: 1px solid #e6e7e9; border-radius: 30px;
  background: #fff; box-shadow: 0 4px 20px rgba(0, 0, 0, .035);
}
.agent-container .input-box-container:focus-within { border-color: #cecece; box-shadow: 0 3px 20px rgba(0, 0, 0, .06); }
.composer-add { grid-area: add; align-self: center; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #444; font-size: 25px; line-height: 1; cursor: pointer; }
.composer-add:hover { background: #f2f2f2; }
.composer-add:focus-visible { outline: 2px solid #2c66ce; outline-offset: 2px; }
.composer-add:disabled { opacity: .4; cursor: default; }
.agent-container .legacy-attach-button { display: none; }
.agent-container .input-box-container .message-input { width: 100%; min-width: 0; min-height: 26px; font-size: 15px; line-height: 24px; padding: 1px 4px; color: #222; }
.agent-container .message-input::placeholder { color: #96999e; font-size: 15px; }
.agent-container .input-trailing { align-self: center; gap: 8px; }
.agent-container .input-trailing .input-action-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border-radius: 50%; }
.agent-container .input-trailing .legacy-attach-button { display: none; }
.agent-container .send-button { display: grid; place-items: center; width: 38px; height: 38px; min-width: 38px; padding: 0; border-radius: 50%; border: 0; color: white; background: #2c66ce; box-shadow: none; }
.agent-container .send-button:disabled { background: #e9e9e9; color: #9b9b9b; opacity: 1; }
.agent-container .messages-container { background: transparent; padding: 28px max(24px, calc((100% - 960px) / 2)); }
.agent-container .message-group { max-width: 100%; }
.agent-message-attachments { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin: 0 0 8px; }
.agent-message-attachment { display: inline-flex; align-items: center; gap: 11px; width: 240px; max-width: 100%; height: 64px; max-height: 64px; padding: 8px 13px; box-sizing: border-box; border: 1px solid #e1e4e8; border-radius: 12px; background: linear-gradient(145deg, #fff, #f6f8fa); color: #4b5563; font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; box-shadow: 0 2px 7px rgba(28, 41, 61, .05); }
.agent-message-attachment:hover { border-color: #c8d3e3; }
.agent-message-attachment span:last-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.agent-message-attachment-image { width: 38px; height: 38px; border-radius: 7px; object-fit: cover; }
.agent-message-file-icon { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 9px; background: #eaf0f9; color: #5d7dab; }
.agent-message-file-icon svg { width: 25px; height: 25px; }
:global(.dark) .agent-message-attachment { border-color: #3b414b; background: linear-gradient(145deg, #292e36, #22272f); color: #cbd5e1; }
:global(.dark) .agent-message-file-icon { background: #344258; color: #a4bee5; }
.agent-container .message-bubble.user { background: #eeeeef; color: #222; border: 0; border-radius: 24px; padding: 12px 20px; box-shadow: none; }
.agent-container .attachments-list { max-width: 820px; margin: 0 auto 12px; }
:global(.dark) .agent-container .agent-chat { background: #171717; }
:global(.dark) .agent-container .input-container { background: transparent; }
:global(.dark) .agent-container .input-box-container { background: #242424; border-color: #393939; }
:global(.dark) .agent-container .message-input, :global(.dark) .composer-add { color: #ededed; }
:global(.dark) .agent-container .message-bubble.user { background: #303030; color: #eee; }
@media (max-width: 640px) {
  .agent-container .input-container { padding: 12px 12px 18px; }
  .agent-container .input-box-container { min-height: 60px; padding: 6px 8px 6px 12px; gap: 4px; }
  .agent-container .input-box-container .message-input, .agent-container .message-input::placeholder { font-size: 15px; }
  .agent-container .send-button { width: 40px; height: 40px; min-width: 40px; }
}
.agent-container {
  --agent-accent: #5f7ea8;
  --agent-accent-soft: #e7eef8;
  --agent-surface: #ffffff;
  --agent-surface-muted: #f6f7f9;
  --agent-surface-soft: #f1f4f8;
  --agent-border: #dde3ea;
  --agent-text: #2b3138;
  --agent-text-muted: #6f7782;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f8fa;
  user-select: none;
}

/* 聊天内容和输入仍可复制，界面控件不参与拖选。 */
.agent-container .message-content,
.agent-container .message-bubble.user,
.agent-container .agent-run-details,
.agent-container .agent-message-details,
.agent-container :deep(.detail-content),
.agent-container input,
.agent-container textarea {
  user-select: text;
}
.agent-container button,
.agent-container .agent-message-toolbar,
.agent-container .agent-message-attachments {
  user-select: none;
}

.chat-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--agent-border);
  background: rgba(248, 249, 251, 0.96);
  backdrop-filter: blur(8px);
}

.chat-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chat-title {
  color: var(--agent-text);
  font-size: 18px;
  font-weight: 600;
}

.chat-subtitle {
  color: var(--agent-text-muted);
  font-size: 13px;
}

.back-button {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--agent-border);
  background: var(--agent-surface);
  color: var(--agent-text-muted);
}

.back-button:hover {
  border-color: #c5d1df;
  background: var(--agent-surface-soft);
}

/* 主内容区：左 + 右栏 */
.agent-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.agent-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.agent-home-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 对话区：min-height: 0 让 flex 子项可收缩，避免把底部输入框推出视口 */
.agent-chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: none;
  background: transparent;
}

.messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  background: #f7f8fa;
}

.message-group {
  display: flex;
  flex-direction: column;
}

.message-group.user {
  align-items: flex-end;
}

.message-group.assistant {
  align-items: flex-start;
  width: 100%;
}

.message-bubble {
  max-width: 70%;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-2xl);
  line-height: 1.6;
  word-wrap: break-word;
  box-shadow: var(--shadow-sm);
}

.message-bubble.user {
  background: #e8eef7;
  color: #243347;
  border: 1px solid #d3ddea;
  border-bottom-right-radius: var(--radius-sm);
  box-shadow: 0 4px 10px rgba(35, 52, 76, 0.08);
  font-size: 17px;
}

.message-bubble.assistant {
  width: 100%;
  max-width: 100%;
  background: transparent;
  box-shadow: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* 生成文件卡片区块（独立于 ToolCallCard） */
.generated-files-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 520px;
  margin: 6px 0;
}

.file-tool-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f7fb;
  border: 1px dashed #d7dee9;
  border-radius: 10px;
  font-size: 13px;
  color: #6d7582;
  margin: 6px 0;
}
.file-tool-loading-icon {
  font-size: 16px;
}

/* 正文 Markdown 样式（Agent 助手消息） */
.message-content.assistant-body {
  width: min(100%, 860px);
  max-width: 100%;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  box-sizing: border-box;
  font-size: 15px;
  line-height: 1.75;
  color: var(--agent-text);
  overflow-x: auto;
}

.message-content.assistant-body :deep(h1),
.message-content.assistant-body :deep(h2),
.message-content.assistant-body :deep(h3),
.message-content.assistant-body :deep(h4) {
  margin: 1.25em 0 0.5em;
  color: var(--agent-text);
  font-weight: 600;
  line-height: 1.4;
}
.message-content.assistant-body :deep(h1) { font-size: 1.4em; }
.message-content.assistant-body :deep(h2) { font-size: 1.2em; }
.message-content.assistant-body :deep(h3) { font-size: 1.08em; }
.message-content.assistant-body :deep(h4) { font-size: 1em; }
.message-content.assistant-body :deep(h5),
.message-content.assistant-body :deep(h6) { margin: 1.1em 0 0.45em; font-size: 1em; line-height: 1.45; }
.message-content.assistant-body :deep(h1:first-child),
.message-content.assistant-body :deep(h2:first-child),
.message-content.assistant-body :deep(h3:first-child),
.message-content.assistant-body :deep(h4:first-child) { margin-top: 0; }

:global(.dark) .messages-container {
  background: #020617;
}

:global(.dark) .message-bubble.user {
  background: rgba(30, 41, 59, 0.96);
  color: #ffffff;
  border-color: rgba(71, 85, 105, 0.88);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
}

:global(.dark) .message-content,
:global(.dark) .message-content.assistant-body,
:global(.dark) .message-content.assistant-body :deep(h1),
:global(.dark) .message-content.assistant-body :deep(h2),
:global(.dark) .message-content.assistant-body :deep(h3),
:global(.dark) .message-content.assistant-body :deep(h4),
:global(.dark) .message-content.assistant-body :deep(h5),
:global(.dark) .message-content.assistant-body :deep(h6),
:global(.dark) .message-content.assistant-body :deep(p),
:global(.dark) .message-content.assistant-body :deep(ul),
:global(.dark) .message-content.assistant-body :deep(ol),
:global(.dark) .message-content.assistant-body :deep(li),
:global(.dark) .message-content.assistant-body :deep(strong) {
  color: #ffffff;
}

.message-content.assistant-body :deep(p) {
  margin: 0.65em 0;
}

.message-content.assistant-body :deep(p:first-child) {
  margin-top: 0;
}

.message-content.assistant-body :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content.assistant-body :deep(ul),
.message-content.assistant-body :deep(ol) {
  margin: 0.65em 0;
  padding-left: 1.4em;
}

.message-content.assistant-body :deep(li) {
  margin: 0.25em 0;
  font-size: 1em;
}
.message-content.assistant-body :deep(li > p) { margin: 0.3em 0; }
.message-content.assistant-body :deep(li > ul),
.message-content.assistant-body :deep(li > ol) { margin: 0.35em 0; }
.message-content.assistant-body :deep(hr) { height: 1px; margin: 1.5em 0; border: 0; background: #e1e6ec; }
:global(.dark) .message-content.assistant-body :deep(hr) { background: #3b4655; }

.message-content.assistant-body :deep(a) {
  color: #476a99;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
.message-content.assistant-body :deep(a:focus-visible) { outline: 2px solid #7e9ac2; outline-offset: 3px; border-radius: 3px; }

.message-content.assistant-body :deep(a:hover) {
  color: #345277;
}

.message-content.assistant-body :deep(.agent-download-card) {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(100%, 348px);
  min-height: 68px;
  margin: 8px auto;
  padding: 10px 13px;
  box-sizing: border-box;
  border: 1px solid #e0e5ec;
  border-radius: 12px;
  background: #fafbfd;
  color: #334155;
  text-decoration: none;
  user-select: none;
  box-shadow: 0 2px 8px rgba(27, 43, 66, .045);
}
.message-content.assistant-body :deep(.agent-download-card:hover) { border-color: #aabed9; background: #f5f8fc; box-shadow: 0 4px 14px rgba(27, 43, 66, .08); }
.message-content.assistant-body :deep(.agent-download-icon) { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 10px; background: #eaf0f9; color: #5d7dab; }
.message-content.assistant-body :deep(.agent-download-icon svg) { width: 27px; height: 27px; }
.message-content.assistant-body :deep(.agent-download-info) { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 2px; }
.message-content.assistant-body :deep(.agent-download-name) { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; font-weight: 600; line-height: 1.4; }
.message-content.assistant-body :deep(.agent-download-meta) { color: #8993a1; font-size: 11px; line-height: 1.3; }
.message-content.assistant-body :deep(.agent-download-action) { display: grid; place-items: center; width: 29px; height: 29px; flex: none; border-radius: 7px; color: #71839b; }
.message-content.assistant-body :deep(.agent-download-action svg) { width: 18px; height: 18px; }
.message-content.assistant-body :deep(.agent-download-card:hover .agent-download-action) { background: #e5edf8; color: #406a9e; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-card) { border-color: #3a485b; background: #232d3b; color: #d6e3f3; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-icon) { background: #344762; color: #a9c9f5; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-meta) { color: #97a5b6; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-action) { color: #a9bdd5; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-card:hover) { background: #293648; border-color: #607897; }
:global(.dark) .message-content.assistant-body :deep(.agent-download-card:hover .agent-download-action) { background: #3a4b63; color: #d5e5fa; }

:global(.dark) .message-content.assistant-body :deep(a) {
  color: #93c5fd;
}

:global(.dark) .message-content.assistant-body :deep(a:hover) {
  color: #bfdbfe;
}
:global(.dark) .message-content.assistant-body :deep(a.agent-download-card),
:global(.dark) .message-content.assistant-body :deep(a.agent-download-card:hover) { color: #d6e3f3; }

.message-content.assistant-body :deep(strong) {
  font-weight: 600;
  color: var(--agent-text);
}

.message-content.assistant-body :deep(em) {
  font-style: italic;
}

.message-content.assistant-body :deep(code:not(pre code)) {
  background: rgba(85, 104, 130, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.95em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #3f4f63;
}

:global(.dark) .message-content.assistant-body :deep(code:not(pre code)) {
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
}

.message-content.assistant-body :deep(pre) {
  margin: 1em 0;
  padding: 1em;
  border-radius: var(--radius-md);
  background: #f3f6fb;
  overflow-x: auto;
  font-size: 0.95em;
  line-height: 1.5;
  white-space: pre;
}

:global(.dark) .message-content.assistant-body :deep(pre) {
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(71, 85, 105, 0.85);
}

.message-content.assistant-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: inherit;
  white-space: inherit;
}

.message-content.assistant-body :deep(blockquote) {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 3px solid #d6dfeb;
  color: #677284;
}

:global(.dark) .message-content.assistant-body :deep(blockquote) {
  border-left-color: rgba(148, 163, 184, 0.7);
  color: #cbd5e1;
}

.message-content.assistant-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1.1em 0 1.25em;
  font-size: 0.94em;
  line-height: 1.6;
  min-width: 420px;
}

.message-content.assistant-body :deep(th),
.message-content.assistant-body :deep(td) {
  border: 0;
  border-bottom: 1px solid #e1e6ec;
  padding: 0.65em 0.8em;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.message-content.assistant-body :deep(th:first-child),
.message-content.assistant-body :deep(td:first-child) {
  width: 22%;
  min-width: 120px;
}

:global(.dark) .message-content.assistant-body :deep(th),
:global(.dark) .message-content.assistant-body :deep(td) {
  border-color: rgba(71, 85, 105, 0.85);
  color: #e5e7eb;
}

.message-content.assistant-body :deep(th) {
  background: #f4f6f8;
  font-weight: 600;
}

:global(.dark) .message-content.assistant-body :deep(th) {
  background: rgba(30, 41, 59, 0.92);
  color: #ffffff;
}

.message-content.assistant-body :deep(img) {
  max-width: 100%;
  height: auto;
  max-height: 320px;
  border-radius: var(--radius-md);
}
.message-content.assistant-body :deep(input[type='checkbox']) { margin-right: 0.4em; accent-color: #5d7dab; }

/* 附件读取中的波浪提示 */
.attachment-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  margin-bottom: 8px;
}

.attachment-loading-text {
  color: var(--agent-text-muted);
  font-size: 14px;
  letter-spacing: 0.01em;
}

:global(.dark) .attachment-loading-text,
:global(.dark) .messages-loading-text,
:global(.dark) .attach-card-type {
  color: #cbd5e1;
}

.attachment-loading-wave {
  position: relative;
  width: 22px;
  height: 14px;
  color: var(--agent-text-light, #94a3b8);
  overflow: hidden;
}

.attachment-loading-wave::before {
  content: "";
  position: absolute;
  inset: 4px 4px 4px 0;
  background:
    linear-gradient(135deg, transparent 44%, currentColor 44% 56%, transparent 56%) 0 50% / 8px 8px repeat-x,
    linear-gradient(225deg, transparent 44%, currentColor 44% 56%, transparent 56%) 4px 50% / 8px 8px repeat-x;
  opacity: 0.9;
  animation: attachment-loading-wave 0.9s linear infinite;
}

.attachment-loading-wave::after {
  content: "";
  position: absolute;
  top: 1px;
  right: 0;
  width: 2px;
  height: 12px;
  border-radius: 2px;
  background: currentColor;
  animation: attachment-loading-caret 1s steps(1, end) infinite;
}

@keyframes attachment-loading-wave {
  from { transform: translateX(0); }
  to { transform: translateX(-8px); }
}

@keyframes attachment-loading-caret {
  0%, 45% { opacity: 1; }
  46%, 100% { opacity: 0.25; }
}

.agent-message-actions { position: relative; margin-top: 5px; }
.agent-message-toolbar { display: inline-flex; align-items: center; gap: 2px; min-height: 32px; padding: 2px 4px; border: 1px solid #e7e9ed; border-radius: 9px; background: #f8f9fa; }
.agent-message-action { display: grid; place-items: center; width: 29px; height: 29px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #7f8791; cursor: pointer; }
.agent-message-action:hover { background: #e9edf2; color: #3d4652; }
.agent-message-action:disabled { opacity: .4; cursor: default; }
.agent-message-action:focus-visible { outline: 2px solid #7e9ac2; outline-offset: 2px; }
.agent-message-action svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.agent-message-action svg circle { fill: currentColor; stroke: none; }
.agent-message-details { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 20; display: grid; gap: 8px; width: 190px; max-width: calc(100vw - 48px); padding: 12px 14px; border: 1px solid #e7e9ed; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px rgba(28, 41, 61, .08); color: #68717e; font-size: 12px; }
.agent-message-details div { display: flex; justify-content: space-between; gap: 16px; }
.agent-message-details strong { color: #343d49; font-weight: 500; }
:global(.dark) .agent-message-toolbar { border-color: #3b414b; background: #252a31; }
:global(.dark) .agent-message-action { color: #a8b2bf; }
:global(.dark) .agent-message-action:hover { background: #343c47; color: #ecf1f7; }
:global(.dark) .agent-message-details { border-color: #3b414b; background: #252a31; color: #a8b2bf; }
:global(.dark) .agent-message-details strong { color: #e2e8f0; }

/* Thinking 块 */
.thinking-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-md);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast);
}

.thinking-header:hover {
  background: var(--bg-tertiary);
}

.thinking-icon {
  font-size: 1rem;
}

.thinking-title {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.thinking-toggle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.thinking-content {
  padding: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  border-top: 1px solid var(--border-light);
}

/* 附件卡片：与 Chat 一致的高级感，但更紧凑 */
.attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.attach-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 9px 34px 9px 9px;
  border-radius: 12px;
  border: 1px solid var(--agent-border);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.06);
  max-width: min(300px, 100%);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

:global(.dark) .attach-card {
  background: linear-gradient(160deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92));
  border-color: rgba(71, 85, 105, 0.85);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.attach-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

:global(.dark) .attach-card:hover {
  border-color: rgba(96, 165, 250, 0.7);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.36);
}

.attach-card-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(226, 232, 240, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

:global(.dark) .attach-card-icon {
  background: rgba(51, 65, 85, 0.92);
}

.attach-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attach-card-preview-btn {
  border: none;
  padding: 0;
  cursor: zoom-in;
}

.attach-card-file-icon {
  width: 100%;
  height: 100%;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

:global(.dark) .attach-card-file-icon {
  color: #cbd5e1;
}

.attach-card-file-icon.is-text {
  color: #2563eb;
}

:global(.dark) .attach-card-file-icon.is-text {
  color: #93c5fd;
}

.attach-card-file-svg {
  width: 18px;
  height: 18px;
}

.attach-card-ext-pill {
  position: absolute;
  bottom: 1px;
  right: 2px;
  border-radius: 999px;
  padding: 1px 4px;
  font-size: 8px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

:global(.dark) .attach-card-ext-pill {
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(71, 85, 105, 0.85);
}

.attach-card-progress {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 34px;
  height: 34px;
  pointer-events: none;
}

.image-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(4px);
}

.image-preview-dialog {
  position: relative;
  max-width: min(92vw, 1080px);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.image-preview-close {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.82);
  color: #fff;
  cursor: pointer;
}

.image-preview-img {
  display: block;
  max-width: 100%;
  max-height: calc(92vh - 48px);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
  object-fit: contain;
}

.image-preview-name {
  max-width: min(92vw, 1080px);
  color: #e2e8f0;
  font-size: 13px;
  text-align: center;
  word-break: break-word;
}

.attach-card-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.attach-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--agent-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.dark) .attach-card-name {
  color: #ffffff;
}

.attach-card-type {
  font-size: 11.5px;
  color: var(--agent-text-muted);
}

.attach-card-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.68);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.16s ease;
}

.attach-card-remove:hover {
  background: rgba(239, 68, 68, 0.9);
}

/* 输入框（参考 Chat.vue input-box-container，无 input-prefix-btn） */
.input-container {
  padding: var(--spacing-md) var(--spacing-xl);
  background: rgba(247, 248, 250, 0.94);
  border-top: 1px solid var(--agent-border);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

:global(.dark) .input-container {
  background: rgba(2, 6, 23, 0.94);
  border-top-color: rgba(71, 85, 105, 0.85);
}

.input-box-container {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "primary trailing";
  align-items: end;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--agent-border);
  border-radius: var(--radius-2xl);
  background: #ffffff;
  min-height: 56px;
  --input-max-height: 200px;
  /* 容器最大高度需包含 padding，避免 textarea 到顶后被裁切 */
  max-height: calc(var(--input-max-height) + 24px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

:global(.dark) .input-box-container {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(71, 85, 105, 0.85);
}

.input-box-container:focus-within {
  border-color: var(--agent-accent);
  box-shadow: 0 0 0 3px rgba(95, 126, 168, 0.14);
}

:global(.dark) .input-box-container:focus-within {
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
}

.input-box-container.input-box-has-attachments {
  border-color: #d8e0ea;
  background: linear-gradient(180deg, #ffffff, #f7f9fc);
  box-shadow: 0 10px 24px rgba(31, 45, 66, 0.08);
}

:global(.dark) .input-box-container.input-box-has-attachments {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.92));
  border-color: rgba(71, 85, 105, 0.9);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
}

.input-box-container .message-input {
  grid-area: primary;
  flex: unset;
  min-height: 28px;
  max-height: var(--input-max-height);
  padding: 4px 8px;
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
  font-size: 15px;
  line-height: 1.5;
  color: var(--agent-text);
  resize: none;
  overflow-y: hidden;
  scrollbar-width: thin;
  font-family: inherit;
  box-sizing: border-box;
}

/* 右侧操作区：发送/停止按钮，垂直居中 */
.input-trailing {
  grid-area: trailing;
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-input::placeholder {
  color: #9a8a76;
  font-size: 14px;
}

:global(.dark) .message-input {
  color: #ffffff;
}

:global(.dark) .message-input::placeholder {
  color: #94a3b8;
}

.message-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-button {
  width: 38px;
  height: 38px;
  border: none;
  background: linear-gradient(140deg, #8ba3c2, #6f8fb6);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.1rem;
  box-shadow: 0 8px 18px rgba(72, 98, 132, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  filter: brightness(1.02);
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(72, 98, 132, 0.28);
}

.input-action-btn {
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--agent-text-muted);
}

.input-action-btn:hover:not(:disabled) {
  border-color: rgba(159, 178, 203, 0.45);
  background: rgba(95, 126, 168, 0.08);
  color: #4f698a;
}

:global(.dark) .input-action-btn {
  color: #cbd5e1;
}

:global(.dark) .input-action-btn:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(59, 130, 246, 0.12);
  color: #ffffff;
}

.attach-btn-icon {
  width: 18px;
  height: 18px;
}

.message-bubble.assistant :deep(.think-label) {
  color: var(--agent-text-muted);
}

.agent-run { width: min(100%, 860px); max-width: 100%; margin-bottom: 2px; }
.agent-run-toggle { display: inline-flex; align-items: center; gap: 9px; min-height: 32px; padding: 3px 6px; border: 0; border-radius: 6px; background: transparent; color: #7c8592; font: inherit; font-size: 13px; cursor: pointer; }
.agent-run-toggle:hover { background: rgba(105, 125, 150, .07); color: #424b58; }
.agent-run-toggle:focus-visible { outline: 2px solid #7e9ac2; outline-offset: 2px; }
.agent-run-title { color: #535d6b; font-weight: 500; }
.agent-run-duration { color: #929aa5; font-size: 12px; }
.agent-run-toggle.is-running .agent-run-title,
.agent-run-toggle.is-running .agent-run-duration {
  color: transparent;
  background: linear-gradient(100deg, #737f8e 28%, #dce4ed 50%, #737f8e 72%);
  background-size: 220% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: agent-run-sheen 2.4s linear infinite;
}
@keyframes agent-run-sheen {
  from { background-position: 200% 0; }
  to { background-position: -20% 0; }
}
.agent-run-chevron { width: 15px; height: 15px; color: #9aa2ad; transition: transform .18s ease; }
.agent-run-chevron.expanded { transform: rotate(180deg); }
.agent-run-details { margin-top: 4px; padding: 7px 0 0 9px; border-top: 1px solid #e8eaee; }
.agent-run-details :deep(.think-card) { margin: 0 0 3px; }
.agent-run-details .agent-step-text { width: 100%; margin: 3px 0 9px; padding: 0 6px; color: #626b78; font-size: 14px; line-height: 1.75; }
:global(.dark) .agent-run-details .agent-step-text { color: #a9b4c3; }
:global(.dark) .agent-run-toggle { color: #a6afba; }
:global(.dark) .agent-run-title { color: #c0c8d3; }
:global(.dark) .agent-run-duration { color: #8994a3; }
:global(.dark) .agent-run-toggle.is-running .agent-run-title,
:global(.dark) .agent-run-toggle.is-running .agent-run-duration {
  background-image: linear-gradient(100deg, #9caabd 28%, #f3f7fc 50%, #9caabd 72%);
}
@media (prefers-reduced-motion: reduce) {
  .agent-run-toggle.is-running .agent-run-title { color: #737f8e; }
  .agent-run-toggle.is-running .agent-run-duration { color: #929aa5; }
  :global(.dark) .agent-run-toggle.is-running .agent-run-title { color: #c0c8d3; }
  :global(.dark) .agent-run-toggle.is-running .agent-run-duration { color: #8994a3; }
  .agent-run-toggle.is-running .agent-run-title,
  .agent-run-toggle.is-running .agent-run-duration { background: none; animation: none; }
}
:global(.dark) .agent-run-details { border-top-color: #354052; }

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 输入框旁的停止按钮（与发送按钮同位置） */
.stop-btn-inline {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--danger);
  color: white;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.stop-btn-inline:hover {
  background: var(--red-600, #dc2626);
  transform: translateY(-1px);
}

.stop-btn-inline .stop-icon {
  font-size: 1rem;
}

/* Toast 提示 */
.toast {
  position: fixed;
  top: var(--spacing-xl);
  right: var(--spacing-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  animation: slideIn 0.3s ease;
  z-index: var(--z-toast);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast-error {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger);
}

.toast-warn {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning);
}

.toast-icon {
  font-size: 1.25rem;
}

.toast-text {
  font-size: 0.875rem;
  font-weight: 500;
}

/* 加载动画 */
.loading-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-md) var(--spacing-lg);
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--text-light);
  animation: loadingPulse 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) { animation-delay: -0.32s; }
.loading-dot:nth-child(2) { animation-delay: -0.16s; }
.loading-dot:nth-child(3) { animation-delay: 0s; }

@keyframes loadingPulse {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.messages-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
}
.messages-loading-text {
  font-size: 0.875rem;
  color: var(--text-light);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

/* 实时语音转文字 / 错误气泡（参考 Chat.vue，Teleport 到 body 仍可应用 scoped 样式） */
.dictation-bubble {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-secondary, #f3f4f6);
  border: 1px solid var(--border-light, #e5e7eb);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: var(--text-primary);
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.dictation-bubble-content {
  flex: 1;
  min-width: 0;
}

.dictation-bubble-fixed {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 100px;
  width: min(88vw, 380px);
  box-sizing: border-box;
  z-index: 9999;
}

.dictation-bubble-error {
  color: var(--danger, #e74c3c);
}
.dictation-bubble-text {
  color: var(--text-primary);
}
.dictation-bubble-placeholder {
  color: var(--text-muted, #6b7280);
  font-style: normal;
}

.dictation-bubble-actions {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin-left: 12px;
  flex-shrink: 0;
}

.dictation-bubble-btn {
  border: none;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--text-muted, #6b7280);
  transition: background 0.15s ease, color 0.15s ease, transform 0.05s ease;
}

.dictation-bubble-btn:hover {
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-primary);
}

.dictation-bubble-btn:active {
  transform: scale(0.97);
}

.dictation-bubble-btn-primary {
  background: var(--blue-600, #2563eb);
  color: #fff;
}

.dictation-bubble-btn-primary:hover:not(:disabled) {
  background: var(--blue-700, #1d4ed8);
}

.dictation-bubble-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dictation-bubble-enter-active,
.dictation-bubble-leave-active {
  transition: opacity 0.2s ease;
}
.dictation-bubble-enter-from,
.dictation-bubble-leave-to {
  opacity: 0;
}

/* 麦克风按钮（trailing 区，与附件、发送同排） */
.mic-btn-trailing {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mic-btn-trailing.mic-btn-recording {
  color: var(--red-500, #ef4444);
  animation: mic-pulse 1.2s ease-in-out infinite;
}
.mic-btn-trailing.mic-btn-recording:hover:not(:disabled) {
  background: var(--red-50, #fef2f2);
  color: var(--red-600, #dc2626);
}
.mic-icon {
  width: 20px;
  height: 20px;
}
.mic-icon-stop {
  width: 16px;
  height: 16px;
}
@keyframes mic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

/* 响应式 */
@media (max-width: 768px) {
  .message-bubble {
    max-width: 85%;
  }
  .message-content.assistant-body,
  .message-bubble.assistant :deep(.runtime-tool) {
    width: 100%;
    max-width: 100%;
  }
}
</style>
