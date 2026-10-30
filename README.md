# dds-mentorship

API de ejemplo (Node + Express + TypeScript) para solicitudes de mentoría. Arquitectura en capas (router → controller → service → repo) con persistencia en memoria. El procesamiento automático está detrás de la interfaz `AutomaticReviewerService`; la implementación por defecto (`LlmAutomaticReviewerService`) usa un LLM a través del Vercel AI SDK.

## Requisitos

- Node 20+
- pnpm

## Instalación

```bash
pnpm install
cp .env.example .env
```


## Correr el servidor

```bash
pnpm dev
# o
pnpm build && pnpm start
```

Escucha en `http://localhost:3000` (configurable con `PORT`).

## Endpoints

- `POST /mentorship-requests` — crea una solicitud; responde `201 { id, status: "pendiente" }`.
- `GET /mentorship-requests/:id` — devuelve la solicitud; `404` si no existe.

Campos del body:

| Campo         | Tipo           | Requerido | Nota                                                         |
|---------------|----------------|-----------|--------------------------------------------------------------|
| `email`       | string (email) | sí        |                                                              |
| `username`    | string         | sí        |                                                              |
| `description` | string         | sí        | mínimo 500 caracteres                                        |
| `language`    | string         | no        | código ISO (`es`, `en`, ...); si se omite, lo detecta el LLM |
| `reviewer`    | string (email) | no        | revisor humano asignable                                     |

## Ejemplos con curl

Crear una solicitud:

```bash
DESC=$(printf 'Quiero ayuda con mi proyecto final de la facultad! %.0s' {1..15})
curl -s -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d "{\"email\":\"ana@example.com\",\"username\":\"ana\",\"description\":\"$DESC\",\"language\":\"es\"}"
# → 201 {"id":"...","status":"pendiente"}
```

Consultar el estado (después de ~1s, cuando terminó el procesamiento automático):

```bash
curl -s http://localhost:3000/mentorship-requests/3e625d5c-847b-4167-8ae5-fc6288e7e568
# → { "id":"...", "status":"aceptada"|"rechazada"|"en_revision",
#     "processada_automaticamente": true, "explanation": "...",
#     "detectedLanguage":"es", ... }
```

Validación: `description` corta devuelve 400:

```bash
curl -i -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d '{"email":"x@y.com","username":"ana","description":"muy corto"}'
```

Sin idioma (el LLM lo detecta y responde en el mismo):

```bash
DESC_EN=$(printf 'I would like help with my final university project. %.0s' {1..15})
curl -s -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d "{\"email\":\"j@e.com\",\"username\":\"john\",\"description\":\"$DESC_EN\"}"
```

## Cambiar de proveedor de LLM

Providers soportados: `ollama` (default), `openai`, `openai-compatible`, `anthropic`.


### Ollama (default)

Levantar vLLM:

```bash
ollama serve
ollama pull qwen2.5:7b
```

Editá luego `.env` si es necesario (viene con configuración básica para ollama)

### vLLM (y cualquier server OpenAI-compatible)

Levantar vLLM:

```bash
vllm serve Qwen/Qwen2.5-7B-Instruct --port 8000
```

Configurar `.env`:
```
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://localhost:8000/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
OPENAI_API_KEY=dummy        # vLLM acepta cualquier valor por default
```

El mismo patrón sirve para otros servers OpenAI-compatible (LM Studio, llama.cpp con `--api`, LocalAI, Together, Groq, etc.): apuntá `LLM_BASE_URL` al endpoint `/v1` y, si el server requiere auth, poné la key en `OPENAI_API_KEY`.

### Otros

OpenAI:

```
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

Anthropic:
```
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-5
ANTHROPIC_API_KEY=...
```

## Reviewer alternativo: Detoxify (sin LLM)

Como alternativa al LLM, se puede usar un clasificador de toxicidad liviano
(`unitary/toxic-bert`, ~45 MB, ONNX) que corre dentro del mismo proceso Node
vía [transformers.js](https://huggingface.co/docs/transformers.js). No genera
descripciones: sólo clasifica la toxicidad del texto.

> No requiere descarga adicional: la primera invocación descarga el modelo (~45 MB) a la cache local de HuggingFace; las siguientes son instantáneas.


```
REVIEWER_IMPL=detoxify
```

No requiere `LLM_PROVIDER` ni API keys. `pnpm install` ya trae
`@huggingface/transformers`.

Prueba rápida:

```bash
pnpm dev
# en otra terminal:
DESC_EN=$(printf 'I want help with my university project! %.0s' {1..20})
curl -s -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d "{\"email\":\"a@b.com\",\"username\":\"ana\",\"description\":\"$DESC_EN\"}"
# esperar ~1s (más la descarga del modelo la primera vez)
curl -s http://localhost:3000/mentorship-requests/<id>
```

Umbrales (hardcodeados en `src/service/detoxify-automatic-reviewer.service.ts`):
- `score >= 0.5` → `rechazada`
- `0.2 <= score < 0.5` → `requiere_revision_manual`
- `score < 0.2` → `aprobada`

## Reviewer alternativo: Llama-Guard-3-1B (Ollama)

Llama-Guard-3-1B es un modelo chico (1B parámetros) de Meta entrenado
específicamente para clasificación de seguridad. Devuelve `safe` o
`unsafe\nS<N>` con la categoría de riesgo. Mapeo:

- `safe` → `aprobada`
- `unsafe` → `rechazada` (la categoría S1–S14 queda en la explanation)
- output no parseable → `requiere_revision_manual`

No genera descripciones (es un clasificador puro, no un chat). Cubre
mejor que Detoxify los criterios "ilegal / dañino" porque tiene categorías
dedicadas (violencia, hate, privacy, armas, suicidio, etc.), pero sigue
sin cubrir "vigilancia / derechos democráticos" como tal.

Levantar el modelo en Ollama:

```bash
ollama serve
ollama pull llama-guard3:1b
```

Configurar `.env`:

```
REVIEWER_IMPL=llama_guard
LLAMA_GUARD_MODEL=llama-guard3:1b
LLAMA_GUARD_BASE_URL=http://localhost:11434/api
```

Prueba:

```bash
pnpm dev
# en otra terminal:
DESC=$(printf 'Quiero ayuda con mi proyecto final de la facultad. %.0s' {1..15})
curl -s -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d "{\"email\":\"a@b.com\",\"username\":\"ana\",\"description\":\"$DESC\"}"

curl -s http://localhost:3000/mentorship-requests/<id>
# → status: "aceptada", explanation: "Llama-Guard: safe. (respuesta generada automáticamente)"
```

## Reviewer alternativo: approve_all (sin modelo)

Reviewer trivial que aprueba todo. Útil para levantar el proyecto sin Ollama,
sin API keys y sin descargar modelos — por ejemplo para demos del flujo HTTP
en una clase o para desarrollar frontend contra la API.

```
REVIEWER_IMPL=approve_all
```

Prueba:

```bash
pnpm dev
# en otra terminal:
DESC=$(printf 'Quiero ayuda con mi proyecto final. %.0s' {1..20})
curl -s -X POST http://localhost:3000/mentorship-requests \
  -H 'content-type: application/json' \
  -d "{\"email\":\"a@b.com\",\"username\":\"ana\",\"description\":\"$DESC\",\"language\":\"es\"}"
# → 201 { "id": "...", "status": "pendiente" }

curl -s http://localhost:3000/mentorship-requests/<id>
# → status: "aceptada", processada_automaticamente: true
```

## Extender con otro reviewer

Implementá `AutomaticReviewerService` (ver `src/service/automatic-reviewer.ts`) y agregá un `case` en el `switch` de `buildReviewer` en `src/inject.ts`:

```ts
case 'mi-impl':
  return new MyOtherReviewerService(...);
```

El `MentorshipService` no sabe que existe un LLM: sólo depende de la interfaz.

## Tests

```bash
pnpm test
```

Los tests inyectan un `AutomaticReviewerService` fake, por lo que no necesitan Ollama ni ninguna API key.
