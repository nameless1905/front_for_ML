// Разбор и «очеловечивание» структурированного ответа модели.

// Достаёт объект структурированного вывода из ответа бэкенда ({ text: "<json>", ... })
export function extractStructured(body) {
  if (!body || typeof body !== 'object') return null
  const raw = body.text
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Подписи полей; неизвестные поля получают подпись из имени ключа
export const FIELD_LABELS = {
  обзор_данных: 'Обзор данных',
  notable_indices: 'Отклонения показателей',
  оценка_динамики: 'Динамика',
  качественные_находки: 'Качественные находки',
  клинический_контекст: 'Клинический контекст',
  checks: 'Проверки согласованности',
  синтез: 'Синтез',
  подсказка_врачу: 'Подсказка врачу',
  verdict: 'Вердикт',
  reason_category: 'Категория причины',
  technical_problem_suspected: 'Подозрение на техническую ошибку',
}

export function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  const s = String(key).replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const VERDICTS = {
  auto_pass: { label: 'Автоматически одобрено', tone: 'ok' },
}

export function verdictInfo(v) {
  if (!v) return { label: '—', tone: 'neutral' }
  if (VERDICTS[v]) return VERDICTS[v]
  const tone = /fail|reject|block|error/i.test(v) ? 'err' : 'warn'
  return { label: labelFor(v), tone }
}

export const POSITIONS = {
  below_range: { label: 'ниже нормы', arrow: '↓', tone: 'low' },
  above_range: { label: 'выше нормы', arrow: '↑', tone: 'high' },
  within_range: { label: 'в норме', arrow: '•', tone: 'ok' },
}

export const CHECK_KINDS = {
  internal_consistency: 'Внутренняя согласованность',
}

export const CONCLUSIONS = {
  passed: { label: 'пройдена', icon: '✓', tone: 'ok' },
  failed: { label: 'не пройдена', icon: '✕', tone: 'err' },
}

export function conclusionInfo(c) {
  return CONCLUSIONS[c] ?? { label: c ?? '—', icon: '?', tone: 'warn' }
}

// Кириллические аббревиатуры, которые не надо переводить в нижний регистр
const CYR_ABBR = new Set(['ОАК', 'ОАМ', 'БАК', 'ЖДА', 'ЦП', 'СОЭ', 'СРБ', 'ЖКТ', 'ДВС', 'ОРВИ', 'ИБС', 'ХБП', 'В12'])

// Модель иногда пишет целые абзацы КАПСОМ — приводим к обычному регистру,
// сохраняя латинские обозначения (MCV, RDW-CV, H/L) и известные аббревиатуры.
export function normalizeCase(s) {
  if (typeof s !== 'string') return s
  const letters = s.match(/\p{L}/gu) || []
  if (letters.length < 12) return s
  const upper = letters.filter((c) => c !== c.toLowerCase()).length
  if (upper / letters.length < 0.7) return s
  return s
    .replace(/[\p{L}\d/-]+/gu, (w) => (/[A-Za-z]/.test(w) || CYR_ABBR.has(w) ? w : w.toLowerCase()))
    .replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase())
}
