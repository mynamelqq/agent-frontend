import { reactive } from 'vue'

// A chat keeps its own request alive while another chat is shown.
export const runningChatIds = reactive(new Set<string>())

export function setChatRunning(chatId: string, running: boolean) {
  if (!chatId) return
  if (running) runningChatIds.add(chatId)
  else runningChatIds.delete(chatId)
}
