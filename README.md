# Minuta 📝

App full-stack de apuntes de reuniones en español.

## Configuración de transcripción de audio (Groq)

Minuta utiliza la API de **Groq** (Whisper `large-v3-turbo`) para la transcripción gratuita de archivos de audio (hasta 25 MB por archivo).

### Cómo obtener una clave de API gratuita de Groq:
1. Regístrate o inicia sesión en [console.groq.com/keys](https://console.groq.com/keys).
2. Crea una nueva clave de API (es 100% gratuita y no requiere tarjeta de crédito).
3. Copia la clave generada.
4. Abre o crea el archivo `backend/.env` y pégala en la variable `GROQ_API_KEY`:
   ```env
   GROQ_API_KEY=gsk_tu_clave_aqui
   ```
