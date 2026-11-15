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

Esta configuración está preparada para desplegar Minuta utilizando **Render Blueprints** (backend) y **Vercel** (frontend).

### 1. Backend en Render (Plan Gratuito)
1. En el panel de Render, selecciona **New** -> **Blueprint**.
2. Conecta tu repositorio `Soofiaa/minuta`.
3. Render detectará el archivo `render.yaml` automáticamente.
4. Completa las variables de entorno que el panel te solicitará:
   - `GROQ_API_KEY`: Tu clave de Groq.
   - `DATABASE_URL`: La cadena de conexión a tu base de datos en Supabase.
5. Haz clic en **Deploy**.

### 2. Frontend en Vercel
1. En Vercel, importa el proyecto y selecciona la carpeta `frontend/`.
2. **Framework Preset:** `Vite`.
3. **Build Command:** `npm run build`.
4. **Output Directory:** `dist`.
5. **Variables de entorno:**
   - `VITE_API_URL`: La URL pública de tu servicio backend en Render (ej. `https://minuta-backend.onrender.com`, sin barra final). **Importante:** Configura esto antes del primer deploy, ya que Vite lo incrusta durante el build.

> **Aviso:** En el plan gratuito de Render, los servicios se duermen tras 15 minutos de inactividad. La primera petición tardará unos 50 segundos en responder ("cold start").

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
