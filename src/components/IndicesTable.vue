<script setup>
import { computed } from 'vue'
import { formatNum, formatRange } from '../case.js'

const props = defineProps({
  rows: { type: Array, required: true },
  showEmpty: { type: Boolean, default: false },
})

const visible = computed(() => (props.showEmpty ? props.rows : props.rows.filter((r) => r.status !== 'empty')))
const hidden = computed(() => props.rows.length - visible.value.length)

const ARROWS = { low: '↓', high: '↑', normal: '', empty: '', unknown: '' }
</script>

<template>
  <div class="wrap">
    <table v-if="visible.length">
      <thead>
        <tr>
          <th>Показатель</th>
          <th class="r">Значение</th>
          <th class="r">Референс</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in visible" :key="r.name" :class="r.status" :title="r.method ?? ''">
          <td class="name">
            {{ r.name }}
            <span v-if="r.flag" class="flag">{{ r.flag }}</span>
          </td>
          <td class="r val">
            <span class="arrow">{{ ARROWS[r.status] }}</span>
            <b>{{ r.status === 'empty' ? '—' : formatNum(r.value) }}</b>
            <span class="unit">{{ r.unit }}</span>
          </td>
          <td class="r ref">{{ formatRange(r.ref_range) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="hidden" class="hidden-note">
      {{ visible.length ? '+' : '' }}{{ hidden }} без значения
    </p>
  </div>
</template>

<style scoped>
.wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 7px 8px;
  border-bottom: 1px dashed var(--border);
  vertical-align: top;
}
tr:last-child td {
  border-bottom: none;
}
.r {
  text-align: right;
  white-space: nowrap;
}
.val b {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}
.unit {
  margin-left: 4px;
  font-size: 11.5px;
  color: var(--muted);
}
.ref {
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.arrow {
  display: inline-block;
  width: 14px;
  font-weight: 700;
}
tr.low .arrow,
tr.low .val b { color: #60a5fa; }
tr.high .arrow,
tr.high .val b { color: #fb7185; }
tr.low td,
tr.high td { background: rgba(255, 255, 255, 0.025); }
tr.empty { color: var(--muted); }
.flag {
  margin-left: 6px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 1px 6px;
  border-radius: 5px;
  color: var(--warn);
  background: rgba(245, 158, 11, 0.12);
}
.hidden-note {
  margin: 6px 8px 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
