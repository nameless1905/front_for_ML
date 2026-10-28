<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: null, required: true },
})

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Простая подсветка синтаксиса JSON без внешних зависимостей
const highlighted = computed(() => {
  const text = typeof props.value === 'string' ? props.value : JSON.stringify(props.value, null, 2)
  return escapeHtml(text).replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'num'
      if (match.startsWith('"')) cls = match.trimEnd().endsWith(':') ? 'key' : 'str'
      else if (match === 'true' || match === 'false') cls = 'bool'
      else if (match === 'null') cls = 'null'
      return `<span class="${cls}">${match}</span>`
    },
  )
})
</script>

<template>
  <pre class="json-view" v-html="highlighted"></pre>
</template>

<style scoped>
.json-view {
  margin: 0;
  padding: 18px 20px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}
.json-view :deep(.key) { color: var(--json-key); }
.json-view :deep(.str) { color: var(--json-string); }
.json-view :deep(.num) { color: var(--json-number); }
.json-view :deep(.bool) { color: var(--json-bool); }
.json-view :deep(.null) { color: var(--json-null); font-style: italic; }
</style>
