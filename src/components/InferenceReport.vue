<script setup>
import { computed } from 'vue'
import GenericValue from './GenericValue.vue'
import {
  labelFor,
  verdictInfo,
  conclusionInfo,
  normalizeCase,
  POSITIONS,
  CHECK_KINDS,
} from '../report.js'

const props = defineProps({
  data: { type: Object, required: true }, // разобранный structured output
  meta: { type: Object, default: () => ({}) }, // остальные поля ответа (backend_used, tokens_generated…)
})

// Текстовые разделы в порядке отображения
const TEXT_SECTIONS = ['обзор_данных', 'оценка_динамики', 'качественные_находки', 'клинический_контекст']
const HANDLED = new Set([
  ...TEXT_SECTIONS,
  'notable_indices',
  'checks',
  'синтез',
  'подсказка_врачу',
  'verdict',
  'reason_category',
  'technical_problem_suspected',
])

const verdict = computed(() => verdictInfo(props.data.verdict))
const indices = computed(() => (Array.isArray(props.data.notable_indices) ? props.data.notable_indices : []))
const checks = computed(() => (Array.isArray(props.data.checks) ? props.data.checks : []))
const passedCount = computed(() => checks.value.filter((c) => c.conclusion === 'passed').length)
const extra = computed(() => Object.entries(props.data).filter(([k]) => !HANDLED.has(k)))
const textSections = computed(() => TEXT_SECTIONS.filter((k) => props.data[k]))

const reason = computed(() => {
  const r = props.data.reason_category
  return r && r !== 'none' ? labelFor(r) : null
})

const position = (p) => POSITIONS[p] ?? { label: p ?? '—', arrow: '•', tone: 'neutral' }
const hasFlag = (f) => f && f !== 'none'
</script>

<template>
  <div class="report">
    <!-- Вердикт -->
    <div class="hero" :class="verdict.tone">
      <div class="hero-main">
        <div class="hero-icon">
          <span v-if="verdict.tone === 'ok'">✓</span>
          <span v-else-if="verdict.tone === 'err'">✕</span>
          <span v-else>!</span>
        </div>
        <div>
          <div class="hero-label">Вердикт</div>
          <div class="hero-value">{{ verdict.label }}</div>
          <code class="hero-code">{{ data.verdict }}</code>
        </div>
      </div>
      <div class="hero-facts">
        <div class="fact">
          <span>Категория причины</span>
          <b>{{ reason ?? 'нет' }}</b>
        </div>
        <div class="fact">
          <span>Техническая ошибка</span>
          <b :class="data.technical_problem_suspected ? 't-warn' : 't-ok'">
            {{ data.technical_problem_suspected ? 'подозревается' : 'не выявлена' }}
          </b>
        </div>
        <div v-if="checks.length" class="fact">
          <span>Проверки</span>
          <b :class="passedCount === checks.length ? 't-ok' : 't-warn'">
            {{ passedCount }} / {{ checks.length }}
          </b>
        </div>
      </div>
    </div>

    <!-- Подсказка врачу -->
    <div v-if="data.подсказка_врачу" class="hint-box">
      <div class="sec-title">💡 {{ labelFor('подсказка_врачу') }}</div>
      <GenericValue :value="data.подсказка_врачу" />
    </div>

    <!-- Синтез -->
    <section v-if="data.синтез" class="card accent">
      <div class="sec-title">{{ labelFor('синтез') }}</div>
      <p class="text">{{ normalizeCase(data.синтез) }}</p>
    </section>

    <!-- Отклонения -->
    <section v-if="indices.length" class="card">
      <div class="sec-title">
        {{ labelFor('notable_indices') }}
        <span class="count">{{ indices.length }}</span>
      </div>
      <ul class="indices">
        <li v-for="(it, i) in indices" :key="i">
          <span class="pos" :class="position(it.position).tone">{{ position(it.position).arrow }}</span>
          <span class="param">{{ it.parameter }}</span>
          <span v-if="hasFlag(it.measurement_flag)" class="flag">{{ it.measurement_flag }}</span>
          <span class="pos-label" :class="position(it.position).tone">{{ position(it.position).label }}</span>
        </li>
      </ul>
    </section>

    <!-- Текстовые разделы -->
    <section v-for="k in textSections" :key="k" class="card">
      <div class="sec-title">{{ labelFor(k) }}</div>
      <GenericValue :value="data[k]" />
    </section>

    <!-- Проверки -->
    <section v-if="checks.length" class="card">
      <div class="sec-title">
        {{ labelFor('checks') }}
        <span class="count">{{ passedCount }}/{{ checks.length }}</span>
      </div>
      <div class="checks">
        <div v-for="(c, i) in checks" :key="i" class="check" :class="conclusionInfo(c.conclusion).tone">
          <div class="check-head">
            <span class="check-icon">{{ conclusionInfo(c.conclusion).icon }}</span>
            <span class="check-kind">{{ CHECK_KINDS[c.kind] ?? labelFor(c.kind) }}</span>
            <span class="check-status">{{ conclusionInfo(c.conclusion).label }}</span>
          </div>
          <div v-if="c.parameters?.length" class="chips">
            <span v-for="p in c.parameters" :key="p" class="chip">{{ p }}</span>
          </div>
          <p v-if="c.наблюдение" class="text small">{{ normalizeCase(c.наблюдение) }}</p>
        </div>
      </div>
    </section>

    <!-- Поля, которых нет в схеме выше -->
    <section v-for="[k, v] in extra" :key="k" class="card">
      <div class="sec-title">{{ labelFor(k) }}</div>
      <GenericValue :value="v" />
    </section>

    <!-- Метаданные ответа -->
    <div v-if="Object.keys(meta).length" class="meta">
      <span v-for="(v, k) in meta" :key="k">
        {{ k }}: <b>{{ v ?? '—' }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.report {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  font-size: 14px;
}

/* Hero */
.hero {
  --tone: var(--muted);
  --tone-bg: rgba(148, 163, 184, 0.08);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
  background: linear-gradient(135deg, var(--tone-bg), transparent 70%);
}
.hero.ok { --tone: var(--ok); --tone-bg: rgba(34, 197, 94, 0.14); }
.hero.warn { --tone: var(--warn); --tone-bg: rgba(245, 158, 11, 0.14); }
.hero.err { --tone: var(--err); --tone-bg: rgba(244, 63, 94, 0.14); }
.hero-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hero-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--bg);
  background: var(--tone);
  box-shadow: 0 0 24px color-mix(in srgb, var(--tone) 50%, transparent);
}
.hero-label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.hero-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tone);
}
.hero-code {
  font-size: 11.5px;
  color: var(--muted);
}
.hero-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
}
.fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fact span {
  font-size: 11.5px;
  color: var(--muted);
}
.fact b {
  font-weight: 600;
}
.t-ok { color: var(--ok); }
.t-warn { color: var(--warn); }

/* Cards */
.card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}
.card.accent {
  border-left: 3px solid var(--accent);
}
.sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}
.count {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  letter-spacing: 0;
}
.text {
  margin: 0;
  line-height: 1.65;
  white-space: pre-wrap;
}
.text.small {
  font-size: 13px;
  color: #cbd5e1;
}

.hint-box {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.08);
}

/* Indices */
.indices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.indices li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border);
}
.indices li:last-child {
  border-bottom: none;
}
.pos {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 7px;
  font-weight: 700;
}
.param {
  flex: 1;
  min-width: 0;
}
.pos-label {
  font-size: 12px;
  white-space: nowrap;
}
.low { color: #60a5fa; }
.pos.low { background: rgba(96, 165, 250, 0.14); }
.high { color: #fb7185; }
.pos.high { background: rgba(251, 113, 133, 0.14); }
.ok { color: var(--ok); }
.neutral { color: var(--muted); }
.flag {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 6px;
  border-radius: 5px;
  color: var(--warn);
  background: rgba(245, 158, 11, 0.12);
}

/* Checks */
.checks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.check {
  --tone: var(--muted);
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--tone);
  background: rgba(2, 6, 23, 0.35);
  color: var(--text);
}
.check.ok { --tone: var(--ok); }
.check.err { --tone: var(--err); }
.check.warn { --tone: var(--warn); }
.check-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.check-icon {
  color: var(--tone);
  font-weight: 700;
}
.check-kind {
  font-weight: 600;
  font-size: 13px;
}
.check-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--tone);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.chip {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--json-key);
  background: rgba(139, 92, 246, 0.12);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 4px 2px;
  font-size: 12px;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
}
.meta b {
  color: var(--text);
  font-weight: 500;
}
</style>
