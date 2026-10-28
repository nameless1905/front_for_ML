# ML Inference UI (Vue 3 + Vite)

## Запуск
```bash
npm install
npm run dev      # http://localhost:5173
```

## Формат запроса
Интерфейс отправляет `POST /generate_open_router` с телом:
```json
{ "prompt": "<текст из левого окна>", "backend": "qwen" }
```
`prompt` уходит строкой (как `case_content_3`), `backend` задаётся полем в шапке.

## Настройка (`.env`)
- `VITE_BACKEND_URL` — адрес бэкенда (`http://localhost:8000`). Dev-сервер Vite проксирует на него запросы, поэтому CORS не нужен.
- `VITE_PREDICT_PATH` — эндпоинт (`/generate_open_router`).
- `VITE_DEFAULT_BACKEND` — значение `backend` по умолчанию (`qwen`).

## Сборка
```bash
npm run build    # статика в dist/
```
