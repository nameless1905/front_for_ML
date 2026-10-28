// Хелперы для читаемого отображения входного случая (case JSON).

// Коды пола в данных. Заполните, когда будет известна кодировка, например { '1': 'женский', '2': 'мужской' }
export const SEX_LABELS = {}

export const sexLabel = (code) =>
  code === null || code === undefined ? '—' : (SEX_LABELS[code] ?? `код ${code}`)

// Похоже ли значение на случай с анализами
export const isCase = (obj) =>
  obj && typeof obj === 'object' && ('current_result' in obj || 'historical_results' in obj)

// Числа из float32 вроде 306.79998779296875 → «306,8»
const numFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })
export const formatNum = (v) => (typeof v === 'number' ? numFmt.format(v) : (v ?? '—'))

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
export function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : dateFmt.format(d)
}

export function formatRange(range) {
  if (!Array.isArray(range)) return '—'
  const [lo, hi] = range
  if (lo == null && hi == null) return '—'
  if (lo == null) return `≤ ${formatNum(hi)}`
  if (hi == null) return `≥ ${formatNum(lo)}`
  return `${formatNum(lo)} – ${formatNum(hi)}`
}

// Положение значения относительно референса: 'low' | 'high' | 'normal' | 'empty' | 'unknown'
export function indexStatus(idx) {
  if (idx?.value === null || idx?.value === undefined) return 'empty'
  if (typeof idx.value !== 'number' || !Array.isArray(idx.ref_range)) return 'unknown'
  const [lo, hi] = idx.ref_range
  if (lo != null && idx.value < lo) return 'low'
  if (hi != null && idx.value > hi) return 'high'
  if (lo == null && hi == null) return 'unknown'
  return 'normal'
}

// { "Гемоглобин": {...} } → массив строк таблицы
export function indexRows(indices) {
  return Object.entries(indices ?? {}).map(([name, idx]) => ({
    name: name.trim(),
    ...idx,
    status: indexStatus(idx),
  }))
}

// "Ферритин_delta_pct" → { name: "Ферритин", value: -83.5, unit: "%" }
export function deltaRows(delta) {
  return Object.entries(delta ?? {}).map(([key, value]) => {
    const pct = key.endsWith('_delta_pct')
    return { name: pct ? key.slice(0, -'_delta_pct'.length) : key.replace(/_/g, ' '), value, unit: pct ? '%' : '' }
  })
}
