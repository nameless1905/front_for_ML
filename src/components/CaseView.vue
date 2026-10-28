<script setup>
import { ref, computed } from 'vue'
import IndicesTable from './IndicesTable.vue'
import GenericValue from './GenericValue.vue'
import { isCase, sexLabel, formatDate, formatNum, indexRows, deltaRows } from '../case.js'

const props = defineProps({
  data: { type: null, required: true },
})

const showEmpty = ref(false)

const HANDLED = new Set(['case_id', 'delta_check', 'current_result', 'patient_context', 'historical_results'])

const patient = computed(() => props.data.patient_context ?? {})
const current = computed(() => props.data.current_result)
const currentRows = computed(() => indexRows(current.value?.indices))
const deltas = computed(() => deltaRows(props.data.delta_check))
const history = computed(() =>
  (props.data.historical_results ?? []).map((h) => {
    const rows = indexRows(h.indices)
    return {
      ...h,
      rows,
      deviations: rows.filter((r) => r.status === 'low' || r.status === 'high').length,
      filled: rows.filter((r) => r.status !== 'empty').length,
    }
  }),
)
const extra = computed(() => Object.entries(props.data).filter(([k]) => !HANDLED.has(k)))
</script>

<template>
  <div v-if="isCase(data)" class="case">
    <!-- Пациент и случай -->
    <div class="top">
      <div class="facts">
        <div class="fact">
          <span>Пол</span>
          <b>{{ sexLabel(patient.sex) }}</b>
        </div>
        <div class="fact">
          <span>Возраст</span>
          <b>{{ patient.age_years ?? '—' }} {{ patient.age_years != null ? 'лет' : '' }}</b>
        </div>
        <div class="fact">
          <span>Пациент</span>
          <code>{{ patient.patient_pseudo_id ?? '—' }}</code>
        </div>
      </div>
      <div class="case-id">
        <span>case_id</span>
        <code>{{ data.case_id ?? '—' }}</code>
      </div>
      <label class="toggle">
        <input type="checkbox" v-model="showEmpty" />
        Показывать пустые
      </label>
    </div>

    <!-- Текущий результат -->
    <section v-if="current" class="card current">
      <div class="card-head">
        <div>
          <div class="eyebrow">Текущий результат</div>
          <div class="assay">{{ current.assay_name ?? 'Без названия' }}</div>
        </div>
        <div class="meta">
          <span>{{ formatDate(current.collected_at) }}</span>
          <code v-if="current.assay_standardcode">{{ current.assay_standardcode }}</code>
        </div>
      </div>
      <IndicesTable :rows="currentRows" :show-empty="showEmpty" />
    </section>

    <!-- Дельта-проверка -->
    <section v-if="deltas.length" class="card">
      <div class="eyebrow">Дельта-проверка</div>
      <div class="deltas">
        <div v-for="d in deltas" :key="d.name" class="delta" :class="d.value < 0 ? 'down' : 'up'">
          <span class="delta-name">{{ d.name }}</span>
          <b>{{ d.value > 0 ? '+' : '' }}{{ formatNum(d.value) }}{{ d.unit }}</b>
        </div>
      </div>
    </section>

    <!-- История -->
    <section v-if="history.length" class="card">
      <div class="eyebrow">История · {{ history.length }}</div>
      <div class="history">
        <details v-for="(h, i) in history" :key="i" class="hist">
          <summary>
            <span class="chev">▸</span>
            <span class="hist-name">{{ h.assay_name ?? 'Без названия' }}</span>
            <span v-if="h.deviations" class="dev">{{ h.deviations }} откл.</span>
            <span class="hist-count">{{ h.filled }}/{{ h.rows.length }}</span>
            <span class="hist-date">{{ formatDate(h.collected_at) }}</span>
          </summary>
          <IndicesTable :rows="h.rows" :show-empty="showEmpty" />
        </details>
      </div>
    </section>

    <!-- Прочие поля -->
    <section v-for="[k, v] in extra" :key="k" class="card">
      <div class="eyebrow">{{ k }}</div>
      <GenericValue :value="v" />
    </section>
  </div>

  <!-- Не похоже на случай — общий вид -->
  <div v-else class="case">
    <section class="card"><GenericValue :value="data" /></section>
  </div>
</template>

<style scoped>
.case {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  font-size: 14px;
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
}
.facts {
  display: flex;
  gap: 24px;
}
.fact,
.case-id {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fact span,
.case-id span {
  font-size: 11.5px;
  color: var(--muted);
}
code {
  font-size: 12px;
  color: var(--json-key);
  word-break: break-all;
}
.toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--muted);
  cursor: pointer;
}
.toggle input {
  accent-color: var(--accent);
}

.card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}
.card.current {
  border-left: 3px solid var(--accent);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.eyebrow {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}
.card-head .eyebrow {
  margin-bottom: 2px;
}
.assay {
  font-size: 16px;
  font-weight: 600;
}
.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12.5px;
  color: var(--muted);
}

.deltas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.delta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.35);
}
.delta b {
  font-family: 'JetBrains Mono', monospace;
}
.delta.down b { color: #60a5fa; }
.delta.up b { color: #fb7185; }

.history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hist {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.35);
}
.hist[open] {
  padding-bottom: 8px;
}
summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  list-style: none;
  font-size: 13.5px;
}
summary::-webkit-details-marker {
  display: none;
}
.chev {
  color: var(--muted);
  transition: transform 0.15s;
}
.hist[open] .chev {
  transform: rotate(90deg);
}
.hist-name {
  flex: 1;
  min-width: 0;
  font-weight: 500;
}
.dev {
  font-size: 11.5px;
  padding: 1px 7px;
  border-radius: 999px;
  color: #fb7185;
  background: rgba(251, 113, 133, 0.12);
}
.hist-count {
  font-size: 11.5px;
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
}
.hist-date {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
