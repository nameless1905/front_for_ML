<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { PRESETS } from '../presets.js'

const props = defineProps({
  modelValue: { type: String, required: true },
  endpoint: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const current = computed(() => PRESETS.find((p) => p.id === props.modelValue) ?? PRESETS[0])

function pick(id) {
  emit('update:modelValue', id)
  open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}
watch(open, (v) => (v ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const timeoutLabel = (p) => (p.timeoutMs ? `таймаут ${p.timeoutMs / 1000} с` : 'без таймаута')
</script>

<template>
  <button class="trigger" :disabled="disabled" @click="open = true">
    <span class="tag">запрос</span>
    <span class="name">{{ current.title }}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
  </button>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="overlay" @click.self="open = false">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Выбор запроса">
          <div class="modal-head">
            <h2>Выберите запрос</h2>
            <button class="close" @click="open = false" aria-label="Закрыть">✕</button>
          </div>

          <div class="list">
            <button
              v-for="p in PRESETS"
              :key="p.id"
              class="card"
              :class="{ active: p.id === current.id }"
              @click="pick(p.id)"
            >
              <div class="card-top">
                <span class="radio"></span>
                <span class="card-title">{{ p.title }}</span>
                <span class="chip">{{ timeoutLabel(p) }}</span>
              </div>
              <p class="desc">{{ p.description }}</p>
              <pre class="preview">POST {{ endpoint }}
{ "prompt": "…", "backend": "{{ p.backend }}" }</pre>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 0;
  height: 40px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  overflow: hidden;
  backdrop-filter: blur(10px);
  transition: border-color 0.15s;
}
.trigger:not(:disabled):hover {
  border-color: rgba(6, 182, 212, 0.5);
}
.trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tag {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-2);
  background: rgba(6, 182, 212, 0.1);
  border-right: 1px solid var(--border);
}
.name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
}
.trigger svg {
  width: 16px;
  height: 16px;
  color: var(--muted);
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(4px);
}
.modal {
  width: min(480px, 100%);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.close:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}
.card {
  text-align: left;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s;
}
.card:hover {
  border-color: rgba(139, 92, 246, 0.45);
  background: rgba(139, 92, 246, 0.05);
}
.card.active {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.1);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--muted);
  flex-shrink: 0;
}
.card.active .radio {
  border-color: var(--accent);
  background: radial-gradient(circle, var(--accent) 45%, transparent 50%);
}
.card-title {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 14px;
}
.chip {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--muted);
  background: rgba(148, 163, 184, 0.1);
  padding: 3px 8px;
  border-radius: 999px;
}
.desc {
  margin: 6px 0 10px 26px;
  font-size: 13px;
  color: var(--muted);
}
.preview {
  margin: 0 0 0 26px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--json-string);
  background: rgba(2, 6, 23, 0.5);
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(8px) scale(0.98);
}
</style>
