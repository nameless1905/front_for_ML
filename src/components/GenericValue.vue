<script setup>
import { labelFor, normalizeCase } from '../report.js'

// Рендер произвольного значения для полей, о которых отчёт ничего не знает
defineProps({ value: { type: null, required: true } })

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v)
</script>

<template>
  <span v-if="value === null || value === undefined" class="muted">—</span>
  <span v-else-if="typeof value === 'boolean'" class="pill" :class="value ? 'yes' : 'no'">
    {{ value ? 'да' : 'нет' }}
  </span>
  <p v-else-if="typeof value === 'string'" class="text">{{ normalizeCase(value) }}</p>
  <span v-else-if="typeof value === 'number'" class="num">{{ value }}</span>
  <div v-else-if="Array.isArray(value)" class="arr">
    <span v-if="!value.length" class="muted">пусто</span>
    <div v-for="(item, i) in value" :key="i" class="arr-item">
      <GenericValue :value="item" />
    </div>
  </div>
  <dl v-else-if="isPlainObject(value)" class="obj">
    <template v-for="(v, k) in value" :key="k">
      <dt>{{ labelFor(k) }}</dt>
      <dd><GenericValue :value="v" /></dd>
    </template>
  </dl>
</template>

<style scoped>
.muted { color: var(--muted); }
.text { margin: 0; line-height: 1.6; white-space: pre-wrap; }
.num { font-family: 'JetBrains Mono', monospace; color: var(--json-number); }
.pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; }
.pill.yes { color: var(--warn); background: rgba(245, 158, 11, 0.12); }
.pill.no { color: var(--ok); background: rgba(34, 197, 94, 0.12); }
.arr { display: flex; flex-direction: column; gap: 8px; }
.arr-item { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; }
.obj { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
.obj dt { color: var(--muted); font-size: 12.5px; }
.obj dd { margin: 0; }
</style>
