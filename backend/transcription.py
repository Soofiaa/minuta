"""Transcripción de audio de Minuta.

Proveedor configurable con la variable de entorno TRANSCRIPTION_PROVIDER:

- "groq" (por defecto): API de Groq, modelo whisper-large-v3-turbo.
  Plan gratuito sin tarjeta: hasta 25 MB por archivo y 8 horas de audio
  al día (límites publicados en 2026). Requiere GROQ_API_KEY, gratis en
  https://console.groq.com/keys
- "openai": API de OpenAI, modelo whisper-1 (de pago, US$0,006/min).
  Requiere OPENAI_API_KEY.
- "local": faster-whisper corriendo en la propia máquina, sin clave ni
  costo. Requiere `pip install faster-whisper`; el modelo se descarga
  la primera vez y la transcripción es más lenta en CPU.

La transcripción es el único paso que envía audio a un tercero, y solo
ocurre cuando la usuaria sube un archivo de audio. El análisis de
apuntes (notes_engine) siempre corre en local.
"""

from __future__ import annotations

import os

import requests

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions"

SUPPORTED_EXTENSIONS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"}
MAX_BYTES_GROQ = 25 * 1024 * 1024  # Límite del plan gratuito de Groq.


class TranscriptionError(Exception):
    """Error al transcribir, con un mensaje pensado para mostrarse."""


def get_provider() -> str:
    return os.environ.get("TRANSCRIPTION_PROVIDER", "groq").lower()


def provider_status() -> dict:
    provider = get_provider()
    if provider == "groq":
        configured = bool(os.environ.get("GROQ_API_KEY"))
        message = (
            "Configurado: transcribe con Groq (Whisper, plan gratuito)."
            if configured
            else "Falta GROQ_API_KEY. Créala gratis en console.groq.com/keys y ponla en backend/.env."
        )
    elif provider == "openai":
        configured = bool(os.environ.get("OPENAI_API_KEY"))
        message = (
            "Configurado: transcribe con OpenAI (Whisper, de pago)."
            if configured
            else "Falta OPENAI_API_KEY. Ponla en backend/.env."
        )
    elif provider == "local":
        try:
            import faster_whisper  # noqa: F401

            configured = True
            message = "Configurado: transcribe en local con faster-whisper."
        except ImportError:
            configured = False
            message = "Falta instalar faster-whisper: pip install faster-whisper."
    else:
        configured = False
        message = f"Proveedor desconocido: {provider}. Usa groq, openai o local."
    return {"provider": provider, "configured": configured, "message": message}


def _validate(filename: str, audio_bytes: bytes, max_bytes: int | None) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise TranscriptionError(
            f"Formato no soportado: {ext or '(sin extensión)'}. "
            f"Usa uno de: {', '.join(sorted(SUPPORTED_EXTENSIONS))}."
        )
    if max_bytes and len(audio_bytes) > max_bytes:
        raise TranscriptionError(
            f"El audio pesa {len(audio_bytes) / 1024 / 1024:.1f} MB y el límite "
            f"del plan gratuito es de {max_bytes / 1024 / 1024:.0f} MB. "
            "Divide la grabación en partes más cortas."
        )
    return ext


def _transcribe_api(url: str, api_key: str, model: str, audio_bytes: bytes, filename: str) -> str:
    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, audio_bytes)},
            data={"model": model, "language": "es", "response_format": "json"},
            timeout=300,
        )
    except requests.RequestException as exc:
        raise TranscriptionError(f"No se pudo contactar al servicio de transcripción: {exc}") from exc
    if response.status_code == 401:
        raise TranscriptionError("La clave de API no es válida. Revisa la clave en backend/.env.")
    if response.status_code == 413:
        raise TranscriptionError("El archivo es demasiado grande para el servicio de transcripción.")
    if response.status_code == 429:
        raise TranscriptionError("Se alcanzó el límite de transcripciones. Espera unos minutos e inténtalo de nuevo.")
    if not response.ok:
        raise TranscriptionError(f"El servicio de transcripción devolvió un error ({response.status_code}).")
    text = response.json().get("text", "").strip()
    if not text:
        raise TranscriptionError("La transcripción salió vacía. Revisa que el audio tenga voz audible.")
    return text


def _transcribe_local(audio_bytes: bytes, filename: str) -> str:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise TranscriptionError(
            "faster-whisper no está instalado. Instálalo con: pip install faster-whisper"
        ) from exc
    import tempfile

    ext = os.path.splitext(filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(tmp_path, language="es")
        text = " ".join(segment.text.strip() for segment in segments).strip()
    finally:
        os.unlink(tmp_path)
    if not text:
        raise TranscriptionError("La transcripción salió vacía. Revisa que el audio tenga voz audible.")
    return text


def transcribe(audio_bytes: bytes, filename: str, provider: str | None = None) -> str:
    """Transcribe un audio y devuelve el texto en español."""
    provider = (provider or get_provider()).lower()
    if provider == "groq":
        _validate(filename, audio_bytes, MAX_BYTES_GROQ)
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise TranscriptionError(
                "Falta GROQ_API_KEY. Créala gratis en console.groq.com/keys y ponla en backend/.env. "
                "Sin clave, puedes pegar la transcripción de Meet directamente."
            )
        return _transcribe_api(GROQ_URL, api_key, "whisper-large-v3-turbo", audio_bytes, filename)
    if provider == "openai":
        _validate(filename, audio_bytes, None)
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise TranscriptionError("Falta OPENAI_API_KEY. Ponla en backend/.env.")
        return _transcribe_api(OPENAI_URL, api_key, "whisper-1", audio_bytes, filename)
    if provider == "local":
        _validate(filename, audio_bytes, None)
        return _transcribe_local(audio_bytes, filename)
    raise TranscriptionError(f"Proveedor desconocido: {provider}. Usa groq, openai o local.")
