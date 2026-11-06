<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  sexLabel,
  formatDate,
  formatNum,
  formatRange,
  indexRows,
  indexDeviation,
  formatDeviation,
} from '../case.js'

const API = '/api/cases'
const PAGE = 50

defineProps({ disabled: { type: Boolean, default: false } })
const emit = defineEmits(['select'])

const open = ref(false)
const query = ref('')
const items = ref([])
const loading = ref(false)
const error = ref(null)
const hasMore = ref(false)
const pickingId = ref(null)
const searchEl = ref(null)
let controller = null
let debounce = null

const MAX_OUT = 4 // сколько отклонившихся показателей показывать под строкой

const withUnit = (r) => (r.unit ? `${formatNum(r.value)} ${r.unit}` : formatNum(r.value))
const isOut = (r) => r.status === 'low' || r.status === 'high'

// Сводка по показателям для строки списка.
// Один показатель со значением — выводим его целиком, несколько — счётчик и отклонившиеся
function summarize(indices) {
  const rows = indexRows(indices).filter((r) => r.status !== 'empty')
  if (rows.length === 1) {
    const r = rows[0]
    return {
      single: true,
      value: typeof r.value === 'number' ? withUnit(r) : String(r.value),
      ref: formatRange(r.ref_range),
      status: r.status,
      deviation: formatDeviation(indexDeviation(r)),
    }
  }
  const out = rows.filter(isOut).map((r) => ({
    name: r.name,
    value: withUnit(r),
    ref: formatRange(r.ref_range),
    status: r.status,
    deviation: formatDeviation(indexDeviation(r)),
  }))
  return { single: false, count: rows.length, out }
}

const statusText = (s) => ({ normal: 'в норме', unknown: '—', empty: '—' })[s] ?? ''
async function readError(res) {
  try {
    const body = await res.json()
    return body.detail ?? `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

async function load({ append = false } = {}) {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  const params = new URLSearchParams({ limit: PAGE, offset: append ? items.value.length : 0 })
  if (query.value.trim()) params.set('q', query.value.trim())
  try {
    const res = await fetch(`${API}?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error(await readError(res))
    const data = await res.json()
    // indices нужны только для сводки — дальше их не храним, полный случай грузится при выборе
    const page = data.items.map(({ indices, ...it }) => ({ ...it, summary: summarize(indices) }))
    items.value = append ? [...items.value, ...page] : page
    hasMore.value = data.items.length === PAGE
  } catch (e) {
    if (e.name === 'AbortError') return
    error.value = e.message
    if (!append) items.value = []
  } finally {
    loading.value = false
  }
}

async function pick(item) {
  pickingId.value = item.case_id
  error.value = null
  try {
    const res = await fetch(`${API}/${item.case_id}`)
    if (!res.ok) throw new Error(await readError(res))
    emit('select', await res.json())
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    pickingId.value = null
  }
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

watch(open, async (v) => {
  if (v) {
    window.addEventListener('keydown', onKey)
    if (!items.value.length) load()
    await nextTick()
    searchEl.value?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
    controller?.abort()
  }
})

watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 400)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(debounce)
  controller?.abort()
})
</script>

<template>
  <button class="ghost" :disabled="disabled" @click="open = true">Из базы</button>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="overlay" @click.self="open = false">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Выбор случая из базы">
          <div class="modal-head">
            <h2>Случаи из базы <span class="src">mart.llm_input</span></h2>
            <button class="close" @click="open = false" aria-label="Закрыть">✕</button>
          </div>

          <div class="search">
            <input
              ref="searchEl"
              v-model="query"
              type="search"
              spellcheck="false"
              placeholder="Название исследования, case_id или patient_pseudo_id"
            />
            <span v-if="loading" class="spinner"></span>
          </div>

          <div class="list">
            <div class="row head">
              <span>Пол</span><span>Возраст</span><span>Исследование</span>
              <span>Значение</span><span>Референс</span><span>Отклонение</span>
            </div>
            <button
              v-for="it in items"
              :key="it.case_id"
              class="row item"
              :disabled="!!pickingId"
              :title="`case_id: ${it.case_id}`"
              @click="pick(it)"
            >
              <span class="sex" :class="'s' + it.sex">{{ sexLabel(it.sex) }}</span>
              <span class="age">{{ it.age_years ?? '—' }}</span>
              <span class="assay">
                <span class="assay-name">{{ it.assay_name || '—' }}</span>
                <span class="date">{{ formatDate(it.collected_at) }}</span>
              </span>

              <template v-if="it.summary.single">
                <span class="num val" :class="it.summary.status">{{ it.summary.value }}</span>
                <span class="num ref">{{ it.summary.ref }}</span>
                <span class="num dev" :class="it.summary.status">
                  {{ it.summary.deviation || statusText(it.summary.status) }}
                </span>
              </template>
              <template v-else>
                <span class="num val muted">{{ it.summary.count ? it.summary.count + ' показ.' : 'нет значений' }}</span>
                <span class="num ref">—</span>
                <span class="num dev" :class="it.summary.out.length ? 'high' : it.summary.count ? 'normal' : ''">
                  {{
                    it.summary.out.length
                      ? `${it.summary.out.length} вне нормы`
                      : it.summary.count
                        ? 'все в норме'
                        : '—'
                  }}
                </span>
              </template>

              <span class="pick-spin"><span v-if="pickingId === it.case_id" class="spinner"></span></span>

              <span v-if="!it.summary.single && it.summary.out.length" class="out-list">
                <span v-for="o in it.summary.out.slice(0, MAX_OUT)" :key="o.name" class="out" :class="o.status">
                  <b>{{ o.name }}</b> {{ o.value }} <i>реф. {{ o.ref }}</i> {{ o.deviation }}
                </span>
                <span v-if="it.summary.out.length > MAX_OUT" class="out more-out">
                  ещё {{ it.summary.out.length - MAX_OUT }}
                </span>
              </span>
            </button>

            <p v-if="error" class="msg err">{{ error }}</p>
            <p v-else-if="!loading && !items.length" class="msg">Ничего не найдено</p>
            <button v-if="hasMore && !error" class="more" :disabled="loading" @click="load({ append: true })">
              {{ loading ? 'Загрузка…' : 'Показать ещё' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ghost {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  padding: 5px 10px;
  font-size: 12.5px;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ghost:not(:disabled):hover {
  color: var(--text);
  border-color: rgba(148, 163, 184, 0.35);
}
.ghost:disabled {
  cursor: not-allowed;
  opacity: 0.45;
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
  width: min(1040px, 100%);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
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
.src {
  margin-left: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
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

.search {
  position: relative;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.search input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 36px 9px 12px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  font-size: 13.5px;
  outline: none;
}
.search input:focus {
  border-color: var(--accent);
}
.search .spinner {
  position: absolute;
  right: 28px;
  top: 50%;
  margin-top: -7px;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 8px 12px;
}
.row {
  display: grid;
  grid-template-columns: 84px 64px minmax(0, 1fr) 130px 120px 130px 16px;
  align-items: center;
  gap: 6px 12px;
  width: 100%;
  padding: 9px 10px;
  text-align: left;
  font-size: 13.5px;
}
.row.head {
  position: sticky;
  top: -6px;
  background: var(--bg-2);
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.item {
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.12s;
}
.item:not(:disabled):hover {
  border-color: rgba(139, 92, 246, 0.45);
  background: rgba(139, 92, 246, 0.08);
}
.item:disabled {
  cursor: wait;
}
.sex {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  justify-self: start;
  background: rgba(148, 163, 184, 0.1);
  color: var(--muted);
}
.sex.s0 { color: #7dd3fc; background: rgba(56, 189, 248, 0.12); }
.sex.s1 { color: #f9a8d4; background: rgba(236, 72, 153, 0.12); }
.age {
  font-family: 'JetBrains Mono', monospace;
}
.assay {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.assay-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.date {
  font-size: 11.5px;
  color: var(--muted);
}

.num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.num.ref,
.num.muted,
.num.unknown {
  color: var(--muted);
}
.num.low { color: #7dd3fc; }
.num.high { color: #fda4af; }
.num.dev.normal { color: var(--ok); }
.pick-spin {
  display: flex;
  justify-content: center;
}

/* Отклонившиеся показатели многопоказательного исследования — второй строкой */
.out-list {
  grid-column: 3 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}
.out {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--muted);
}
.out b {
  font-weight: 600;
  color: var(--text);
}
.out i {
  font-style: normal;
  opacity: 0.75;
}
.out.low { box-shadow: inset 2px 0 0 #7dd3fc; }
.out.high { box-shadow: inset 2px 0 0 #fda4af; }

.msg {
  margin: 20px 0;
  text-align: center;
  color: var(--muted);
  font-size: 13.5px;
}
.msg.err {
  color: var(--err);
}
.more {
  display: block;
  margin: 10px auto 0;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  padding: 7px 14px;
  font-size: 13px;
  border-radius: 9px;
  cursor: pointer;
}
.more:not(:disabled):hover {
  color: var(--text);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Узко: значение/референс/отклонение уходят под название */
@media (max-width: 760px) {
  .row {
    grid-template-columns: 70px 44px repeat(3, minmax(0, 1fr)) 16px;
    gap: 4px 8px;
  }
  .assay {
    grid-column: 3 / 6;
  }
  .row.head span:nth-child(n + 4) {
    display: none;
  }
  .item > .val {
    grid-column: 3;
  }
  .pick-spin {
    grid-row: 1;
    grid-column: 6;
  }
  .out-list {
    grid-column: 3 / 6;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
