# Minuta 📝

App full-stack de apuntes de reuniones en español. Pegas o subes la transcripción de una reunión y Minuta genera un resumen, los temas tratados, las decisiones, los pendientes con responsable y fecha, y las preguntas abiertas. Luego puedes editarlo, exportarlo a Markdown y guardarlo.

## Qué problema resuelve

Tomar actas a mano consume la atención de quien debería participar. Minuta convierte una transcripción en apuntes estructurados sin que los datos salgan de tu propio backend, salvo el audio que tú decides transcribir.

> **Uso responsable:** Usa Minuta solo con grabaciones o transcripciones hechas con aviso a todas las personas de la reunión.

## Arquitectura

```
┌──────────────────────────┐        /api (proxy en dev)      ┌─────────────────────────┐
│ Frontend                 │ ──────────────────────────────▶ │ Backend (Flask)         │
│ React 19 + Vite + Tailwind│                                 │ app.py                  │
│ src/components/…         │ ◀────────────────────────────── │  ├─ notes_engine.py     │
└──────────────────────────┘           JSON                   │  │  (análisis por reglas,│
                                                               │  │   local)             │
                                                               │  ├─ transcription.py ───┼──▶ Groq Whisper
                                                               │  │  (solo si subes audio)│   (API externa)
                                                               │  └─ db.py ──▶ SQLite    │
                                                               └─────────────────────────┘
```

- **Frontend:** React + Vite. En desarrollo, Vite redirige `/api` a `http://localhost:5000`.
- **Backend:** Flask. Expone `/api/analyze`, `/api/transcribe`, `/api/transcription/status` y el CRUD de `/api/meetings`.
- **Base de datos:** SQLite (un único archivo, sin servidor).
- **Transcripción:** Groq Whisper (`whisper-large-v3-turbo`). Es el único paso que envía datos a un tercero, y solo cuando subes un audio.

## Instalación local

Requisitos: Python 3.12, Node.js 20 o superior.

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt -r requirements-dev.txt
copy .env.example .env      # en macOS/Linux: cp .env.example .env
python app.py
```

El backend queda en `http://localhost:5000`. Comprueba que responde con `http://localhost:5000/api/health`.

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abre `http://localhost:5173`. No necesitas `VITE_API_URL` en desarrollo: el proxy de Vite envía `/api` al backend.

## Variables de entorno

Se leen desde `backend/.env` (backend) y `frontend/.env.production` (frontend). Plantillas: `backend/.env.example` y `frontend/.env.example`.

| Variable | Dónde | Por defecto | Descripción |
|----------|-------|-------------|-------------|
| `TRANSCRIPTION_PROVIDER` | backend | `groq` | Proveedor de transcripción: `groq`, `openai` o `local` (faster-whisper). |
| `GROQ_API_KEY` | backend | — | Clave de Groq. Obligatoria si el proveedor es `groq`. Ver abajo cómo obtenerla. |
| `OPENAI_API_KEY` | backend | — | Solo si `TRANSCRIPTION_PROVIDER=openai` (de pago). |
| `DATABASE_PATH` | backend | `minuta.db` | Ruta del archivo SQLite. |
| `PORT` | backend | `5000` | Puerto del backend. |
| `VITE_API_URL` | frontend (build) | cadena vacía | URL pública del backend en producción, sin barra final. En desarrollo no se usa. |

### Cómo conseguir la clave gratuita de Groq

1. Entra en [console.groq.com/keys](https://console.groq.com/keys) y crea una cuenta o inicia sesión.
2. Crea una nueva clave de API. Es gratuita y no pide tarjeta de crédito.
3. Copia la clave y ponla en `backend/.env`:
   ```env
   TRANSCRIPTION_PROVIDER=groq
   GROQ_API_KEY=gsk_tu_clave_aqui
   ```

Sin clave, Minuta sigue funcionando: puedes pegar la transcripción directamente. Solo la subida de audio necesita la clave. Comprueba el estado com `GET /api/transcription/status`.

## Deploy (Demo)

Esta configuración está preparada para desplegar Minuta como una **demo** gratuita:

- **Frontend en Vercel:** Importa la carpeta `frontend/`, comando de build `npm run build`, carpeta de salida `dist`. Define la variable de entorno `VITE_API_URL` apuntando a la URL pública del backend en Render.
- **Backend en Render (plan gratuito):** Tipo *Web Service*, entorno Python, directorio raíz `backend/`.
  - **Build Command:** `pip install -r requirements.txt`
  - **Start Command:** `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT`
  - **Variables de entorno en Render:** `TRANSCRIPTION_PROVIDER=groq`, `GROQ_API_KEY=tu_clave`, `DATABASE_PATH=minuta.db`.

> **Aviso importante sobre el plan gratuito de Render:**
> 1. **Inactividad (Spindown):** En el plan gratuito, los servicios web se duermen tras 15 minutos sin tráfico entrante. Cuando llega una nueva petición, el servicio tarda aproximadamente 50 segundos en despertar ("cold start").
> 2. **Almacenamiento efímero:** El disco del plan gratuito de Render es efímero. Cada vez que el servicio se reinicia o se despliega una nueva versión, el archivo SQLite (`minuta.db`) se restablece y se pierden las reuniones guardadas previamente. Es ideal para demos, pero no para almacenamiento persistente en producción.

## Decisiones y límites

- **Minuta nunca graba llamadas.** Solo procesa texto que pegas o archivos que subes.
- **El audio se transcribe solo si lo subes tú.** Es el único dato que sale del backend, y va a Groq.
- **Límite de 25 MB por audio** en el plan gratuito de Groq. Para archivos más grandes, divídelos.
- **El análisis de apuntes corre en local**, con reglas en `backend/notes_engine.py`. No usa modelos de lenguaje ni servicios externos, así que puede perder matices que un modelo captaría.
- **Base de datos SQLite.** Adecuada para uso personal o demo. Para varios usuarios haría falta una base de datos servidor.

## Tests

Backend (pytest):

```bash
cd backend
venv\Scripts\activate
python -m pytest -q
```

Frontend (Vitest):

```bash
cd frontend
npm test -- --run
```

Build de producción:

```bash
cd frontend
npm run build
```

La integración continua (`.github/workflows/ci.yml`) ejecuta los tests de backend y frontend, y el build, en cada push y pull request.
