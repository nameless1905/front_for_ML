// Варианты запроса к /generate_open_router.
// timeoutMs: null — без таймаута.
export const PRESETS = [
  {
    id: 'qwen',
    title: 'qwen',
    description: 'Генерация через Qwen',
    backend: 'qwen',
    timeoutMs: null,
  },
  {
    id: 'anthropic',
    title: 'anthropic',
    description: 'Генерация через Anthropic',
    backend: 'anthropic',
    timeoutMs: 120_000,
  },
]

export const findPreset = (id) => PRESETS.find((p) => p.id === id)
