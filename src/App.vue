<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import JsonView from './components/JsonView.vue'
import PresetPicker from './components/PresetPicker.vue'
import InferenceReport from './components/InferenceReport.vue'
import CaseView from './components/CaseView.vue'
import { PRESETS, findPreset } from './presets.js'
import { extractStructured } from './report.js'

const STORAGE_KEY = 'ml-inference-ui-v2'

const endpoint = ref(import.meta.env.VITE_PREDICT_PATH || '/generate_open_router')
const presetId = ref(findPreset(import.meta.env.VITE_DEFAULT_BACKEND)?.id ?? PRESETS[0].id)
const preset = computed(() => findPreset(presetId.value) ?? PRESETS[0])
const input = ref(
  JSON.stringify(
    {
      features: [5.1, 3.5, 1.4, 0.2],
      params: { top_k: 3 },
    },
    null,
    2,
  ),
)

const loading = ref(false)
const result = ref(null) // { ok, status, statusText, timeMs, body, isJson }
const copied = ref(false)
let controller = null

const inputMode = ref('editor') // 'editor' | 'preview'

// Валидация JSON на лету
const parseError = computed(() => {
  if (!input.value.trim()) return 'Пустой ввод'
  try {
    JSON.parse(input.value)
    return null
  } catch (e) {
    return e.message
  }
})

// prompt уходит строкой, поэтому невалидный JSON не блокирует отправку — только подсвечивается
const parsedInput = computed(() => (parseError.value ? null : JSON.parse(input.value)))

const canSend = computed(() => input.value.trim() && !loading.value && endpoint.value.trim())

function formatInput() {
  if (parseError.value) return
  input.value = JSON.stringify(JSON.parse(input.value), null, 2)
}

function minifyInput() {
  if (parseError.value) return
  input.value = JSON.stringify(JSON.parse(input.value))
}

async function send() {
  if (!canSend.value) return
  // На бэкенд уходит исходный текст, а пользователю показываем читаемый просмотр
  if (!parseError.value) inputMode.value = 'preview'
  const p = preset.value
  controller = new AbortController()
  loading.value = true
  copied.value = false
  const started = performance.now()
  let timedOut = false
  const timer = p.timeoutMs
    ? setTimeout(() => {
        timedOut = true
        controller.abort()
      }, p.timeoutMs)
    : null

  try {
    const res = await fetch(endpoint.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        prompt: input.value,
        backend: p.backend,
      }),
      signal: controller.signal,
    })
    const text = await res.text()
    let body = text
    let isJson = false
    try {
      body = JSON.parse(text)
      isJson = true
    } catch {
      /* ответ не JSON — покажем как текст */
    }
    result.value = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      timeMs: Math.round(performance.now() - started),
      body,
      isJson,
    }
  } catch (e) {
    const aborted = e.name === 'AbortError'
    result.value = {
      ok: false,
      status: timedOut ? 'Таймаут' : aborted ? 'Отменено' : 'Сетевая ошибка',
      statusText: '',
      timeMs: Math.round(performance.now() - started),
      body: timedOut
        ? `Бэкенд не ответил за ${p.timeoutMs / 1000} с`
        : aborted
          ? 'Запрос отменён пользователем'
          : `${e.message}\n\nПроверьте, что бэкенд запущен и адрес указан верно.`,
      isJson: false,
    }
  } finally {
    clearTimeout(timer)
    loading.value = false
    controller = null
    save()
  }
}

function cancel() {
  controller?.abort()
}

async function copyResult() {
  if (!result.value) return
  const b = result.value.body
  await navigator.clipboard.writeText(typeof b === 'string' ? b : JSON.stringify(b, null, 2))
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// Tab в textarea вставляет отступ, Ctrl/Cmd+Enter — отправка
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    send()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const { selectionStart: s, selectionEnd: end } = el
    input.value = input.value.slice(0, s) + '  ' + input.value.slice(end)
    requestAnimationFrame(() => (el.selectionStart = el.selectionEnd = s + 2))
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ endpoint: endpoint.value, preset: presetId.value, input: input.value }),
    )
  } catch {
    /* localStorage недоступен */
  }
}

function onGlobalKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send()
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.endpoint) endpoint.value = saved.endpoint
    const savedPreset = findPreset(saved?.preset ?? saved?.backend)
    if (savedPreset) presetId.value = savedPreset.id
    if (saved?.input) input.value = saved.input
  } catch {
    /* игнорируем битое сохранение */
  }
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

const lineCount = computed(() => input.value.split('\n').length)

// Структурированный вывод модели (поле text ответа) — если удалось разобрать
const viewMode = ref('report') // 'report' | 'json'
const structured = computed(() => (result.value?.isJson ? extractStructured(result.value.body) : null))
const responseMeta = computed(() => {
  if (!structured.value) return {}
  const { text, ...rest } = result.value.body
  return rest
})
// В режиме JSON показываем text уже разобранным, чтобы не читать экранированную строку
const prettyJson = computed(() =>
  structured.value ? { ...result.value.body, text: structured.value } : result.value?.body,
)
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="brand">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" />
            <path d="M7 6.5l3 4.5M7 17.5l3-4.5M14 11l3-4.5M14 13l3 4.5" />
          </svg>
        </div>
        <div>
          <h1>Model Inference</h1>
          <p>Отправьте JSON на бэкенд и посмотрите ответ модели</p>
        </div>
      </div>

      <div class="controls">
        <div class="endpoint">
          <span class="method">POST</span>
          <input v-model="endpoint" @change="save" spellcheck="false" placeholder="/generate_open_router" />
        </div>
        <PresetPicker
          v-model="presetId"
          :endpoint="endpoint"
          :disabled="loading"
          @update:model-value="save"
        />
      </div>
    </header>

    <main class="grid">
      <!-- Ввод -->
      <section class="panel">
        <div class="panel-head">
          <div class="title">
            <span class="dot in"></span>
            Запрос <span class="field">prompt</span>
          </div>
          <div class="tools">
            <template v-if="inputMode === 'editor'">
              <button class="ghost" @click="formatInput" :disabled="!!parseError">Форматировать</button>
              <button class="ghost" @click="minifyInput" :disabled="!!parseError">Сжать</button>
            </template>
            <div class="tabs">
              <button :class="{ active: inputMode === 'editor' }" @click="inputMode = 'editor'">Редактор</button>
              <button
                :class="{ active: inputMode === 'preview' }"
                :disabled="!!parseError"
                @click="inputMode = 'preview'"
              >
                Просмотр
              </button>
            </div>
          </div>
        </div>

        <div v-if="inputMode === 'preview' && parsedInput" class="output">
          <CaseView :data="parsedInput" />
        </div>
        <div v-else class="editor">
          <div class="gutter" aria-hidden="true">
            <span v-for="n in lineCount" :key="n">{{ n }}</span>
          </div>
          <textarea
            v-model="input"
            :rows="lineCount"
            @keydown="onKeydown"
            @blur="save"
            spellcheck="false"
            placeholder='{ "features": [...] }'
          ></textarea>
        </div>

        <div class="panel-foot">
          <span class="validity" :class="parseError ? 'bad' : 'good'">
            {{ parseError ? '✕ ' + parseError : '✓ Валидный JSON' }}
          </span>
          <div class="actions">
            <span class="hint">Ctrl + Enter</span>
            <button v-if="loading" class="secondary" @click="cancel">Отмена</button>
            <button class="primary" :disabled="!canSend" @click="send">
              <span v-if="loading" class="spinner"></span>
              {{ loading ? 'Выполняется…' : 'Запустить инференс' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Вывод -->
      <section class="panel">
        <div class="panel-head">
          <div class="title">
            <span class="dot out"></span>
            Ответ модели
          </div>
          <div class="tools" v-if="result">
            <div v-if="structured" class="tabs">
              <button :class="{ active: viewMode === 'report' }" @click="viewMode = 'report'">Отчёт</button>
              <button :class="{ active: viewMode === 'json' }" @click="viewMode = 'json'">JSON</button>
            </div>
            <span class="badge" :class="result.ok ? 'ok' : 'err'">
              {{ result.status }} {{ result.statusText }}
            </span>
            <span class="badge neutral">{{ result.timeMs }} мс</span>
            <button class="ghost" @click="copyResult">{{ copied ? 'Скопировано' : 'Копировать' }}</button>
          </div>
        </div>

        <div class="output" :class="{ dim: loading }">
          <div v-if="loading && !result" class="placeholder">
            <div class="pulse"></div>
            <p>Модель думает…</p>
          </div>
          <div v-else-if="!result" class="placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2" />
              <path d="M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2" />
            </svg>
            <p>Здесь появится результат инференса</p>
          </div>
          <InferenceReport v-else-if="structured && viewMode === 'report'" :data="structured" :meta="responseMeta" />
          <JsonView v-else-if="result.isJson" :value="prettyJson" />
          <pre v-else class="raw" :class="{ error: !result.ok }">{{ result.body || '(пустой ответ)' }}</pre>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.logo {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.35);
}
.logo svg {
  width: 26px;
  height: 26px;
  color: white;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.brand p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13.5px;
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.field {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.endpoint {
  display: flex;
  align-items: center;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  min-width: min(420px, 100%);
  backdrop-filter: blur(10px);
}
.method {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ok);
  background: rgba(34, 197, 94, 0.1);
  border-right: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace;
}
.endpoint input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  padding: 10px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}

/* Grid */
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 0;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .panel {
    height: 75vh;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  backdrop-filter: blur(14px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  /* Фиксированная высота под экран — содержимое прокручивается внутри панели */
  height: calc(100vh - 150px);
  min-height: 420px;
  overflow: hidden;
}
.panel-head,
.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.panel-head {
  border-bottom: 1px solid var(--border);
}
.panel-foot {
  border-top: 1px solid var(--border);
}
.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.in {
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
.dot.out {
  background: var(--accent-2);
  box-shadow: 0 0 10px var(--accent-2);
}
.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Editor */
.editor {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: auto;
  background: rgba(2, 6, 23, 0.4);
}
.gutter {
  display: flex;
  flex-direction: column;
  padding: 18px 10px 18px 14px;
  text-align: right;
  color: rgba(148, 163, 184, 0.35);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13.5px;
  line-height: 1.6;
  user-select: none;
  border-right: 1px solid var(--border);
}
.editor textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  padding: 18px 16px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre;
  overflow-y: hidden;
  overflow-x: auto;
  min-height: 100%;
  caret-color: var(--accent);
}

/* Output */
.output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: rgba(2, 6, 23, 0.4);
  transition: opacity 0.2s;
}
.output.dim {
  opacity: 0.45;
}
.raw {
  margin: 0;
  padding: 18px 20px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.raw.error {
  color: #fda4af;
}
.placeholder {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
  font-size: 14px;
}
.placeholder svg {
  width: 48px;
  height: 48px;
  opacity: 0.4;
}
.pulse {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}

/* Footer elements */
.validity {
  font-size: 12.5px;
  font-family: 'JetBrains Mono', monospace;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.validity.good { color: var(--ok); }
.validity.bad { color: var(--err); }
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hint {
  font-size: 12px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 7px;
}

/* Buttons */
button {
  cursor: pointer;
  border-radius: 9px;
  transition: all 0.15s ease;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  padding: 10px 18px;
  font-weight: 600;
  font-size: 14px;
  color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.35);
}
.primary:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(139, 92, 246, 0.5);
}
.secondary {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  padding: 9px 14px;
  font-size: 14px;
}
.secondary:hover {
  border-color: var(--err);
  color: var(--err);
}
.ghost {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  padding: 5px 10px;
  font-size: 12.5px;
}
.ghost:not(:disabled):hover {
  color: var(--text);
  border-color: rgba(148, 163, 184, 0.35);
}

.tabs {
  display: flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: rgba(2, 6, 23, 0.4);
}
.tabs button {
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 4px 10px;
  font-size: 12.5px;
  border-radius: 7px;
}
.tabs button.active {
  color: var(--text);
  background: rgba(139, 92, 246, 0.25);
}

.badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
}
.badge.ok { color: var(--ok); background: rgba(34, 197, 94, 0.12); }
.badge.err { color: var(--err); background: rgba(244, 63, 94, 0.12); }
.badge.neutral { color: var(--muted); background: rgba(148, 163, 184, 0.1); }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
