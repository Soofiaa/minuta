"""Motor de apuntes de Minuta.

Analiza una transcripción en español y devuelve apuntes ordenados:
resumen, temas, decisiones, pendientes (con responsable y fecha, cuando
se pueden detectar) y preguntas abiertas.

El análisis es local y por reglas: la transcripción no se envía a ningún
servicio externo. La transcripción de audio sí usa un proveedor externo
(ver transcription.py) y solo cuando la usuaria lo pide explícitamente.
"""

from __future__ import annotations

import re
from collections import Counter

# ---------------------------------------------------------------------------
# Listas y patrones
# ---------------------------------------------------------------------------

STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del",
    "en", "y", "o", "que", "es", "son", "se", "su", "sus", "con", "por",
    "para", "como", "más", "pero", "sus", "este", "esta", "estos", "estas",
    "eso", "esa", "sí", "no", "ya", "si", "al", "lo", "le", "les", "me",
    "te", "nos", "mi", "mis", "tu", "tus", "hay", "fue", "era", "ser",
    "estar", "está", "están", "estamos", "cuando", "donde", "cómo",
    "también", "muy", "bien", "entonces", "ahora", "después", "antes",
    "creo", "vale", "okay", "bueno", "buena", "claro", "pues", "eh",
    "entonces", "acá", "ahí", "eso", "esto", "algo", "nada", "todo",
    "todos", "cada", "otro", "otra", "otros", "otras", "puede", "pueden",
    "debería", "hacer", "hacia", "hasta", "sobre", "entre", "sin",
    "vez", "veces", "día", "días", "hoy", "ayer", "mañana", "reunión",
    "hola", "gracias", "buenos", "tardes", "noches", "parece",
    "nuevo", "decidimos",
    "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
    "reviso", "preparo", "cerramos", "partimos", "preparar",
}

DECISION_PATTERNS = [
    r"\bse (decidió|decide|acordó|acuerda|definió|define)\b",
    r"\b(decidimos|acordamos|definimos|quedamos en)\b",
    r"\b(quedó acordado|quedó decidido|quedó definido)\b",
    r"\bla decisión (es|fue|quedó)\b",
    r"\bse va a (hacer|usar|trabajar|implementar)\b",
]

ACTION_PATTERNS = [
    r"\b(hay que|tengo que|tienes que|tiene que|tenemos que|tienen que)\b",
    r"\b(me encargo|te encargo|se encarga|nos encargamos|me toca|te toca|le toca)\b",
    r"\b(quedó pendiente|queda pendiente|falta (hacer|que|por))\b",
    r"\b(voy a|vas a|va a|vamos a|van a)\s+\w+",
    r"\b(antes del|para mañana|esta semana|próxima semana)\b",
    r"\bpara (el|la) (lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d{1,2})\b",
    r"\bnecesit(o|amos|as|a|an) que\b",
    r"\bque\s+alguien\s+(?:(?:me|te|le|nos|les|lo|la|los|las|se|no)\s+)*[a-záéíóúñü]+(?:a|e|á|é|an|en)\b",
]

# "yo + verbo de acción". Los verbos de opinión o estado no son compromisos.
COMMITMENT_RE = re.compile(
    r"\byo\s+(?:(?:lo|la|los|las|le|les|te|me|nos)\s+)?"
    r"(?!(?:creo|pienso|digo|opino|sé|entiendo|veo|estoy|quiero|considero|supongo|espero)\b)\w+",
    re.IGNORECASE,
)
# "Ana pregunta si...": pregunta indirecta que no termina en "?".
REPORTED_QUESTION_RE = re.compile(r"\bpregunt(a|o|an|amos|ó|aron|ando)\b", re.IGNORECASE)

# Verbos de tarea al inicio de la frase ("Revisar el documento...").
TASK_VERB_START = (
    r"^(enviar|revisar|preparar|actualizar|escribir|agendar|crear|subir|"
    r"compartir|confirmar|pedir|preguntar|llamar|entregar)\b"
)

DATE_PATTERNS = [
    r"\b(el )?\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b",
    r"\b(el )?(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b",
    r"\bmañana\b",
    r"\besta semana\b",
    r"\bpróxima semana\b",
    r"\bantes del [a-záéíóúñ ]{1,25}",
]

SPEAKER_RE = re.compile(
    r"^(?:\*\*)?([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+)?)(?:\*\*)?\s*[:\-–]\s+(.+)$"
)
TIMESTAMP_RE = re.compile(
    r"^\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?\s*(-->)?\s*(\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?)?\s*$"
)
VTT_TAG_RE = re.compile(r"<[^>]+>")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+|\n+")
WORD_RE = re.compile(r"[a-záéíóúñü]+", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Limpieza y parseo de la transcripción
# ---------------------------------------------------------------------------


def clean_transcript_text(text: str) -> str:
    """Quita marcas de VTT/SRT (timestamps, ids, etiquetas) del texto."""
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.upper() == "WEBVTT":
            continue
        if line.isdigit():
            continue
        if TIMESTAMP_RE.match(line):
            continue
        line = VTT_TAG_RE.sub("", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def parse_transcript(text: str) -> list[dict]:
    """Divide la transcripción en intervenciones {speaker, text}."""
    cleaned = clean_transcript_text(text)
    utterances: list[dict] = []
    for line in cleaned.splitlines():
        line = line.strip()
        if not line:
            continue
        match = SPEAKER_RE.match(line)
        if match and len(match.group(1)) <= 30:
            utterances.append({"speaker": match.group(1), "text": match.group(2).strip()})
        elif utterances and utterances[-1]["speaker"] is None:
            utterances[-1]["text"] += " " + line
        else:
            utterances.append({"speaker": None, "text": line})
    return utterances


def _split_sentences(text: str) -> list[str]:
    sentences = []
    for part in SENTENCE_SPLIT_RE.split(text):
        sentence = part.strip(" \t\r\n\"'“”()")
        if len(sentence) >= 3:
            sentences.append(sentence)
    return sentences


def _content_words(text: str) -> list[str]:
    return [w.lower() for w in WORD_RE.findall(text) if w.lower() not in STOPWORDS and len(w) > 2]


# ---------------------------------------------------------------------------
# Análisis
# ---------------------------------------------------------------------------


def _resumen(sentences: list[str], top_n: int = 4) -> list[str]:
    candidates = [s for s in sentences if not s.endswith("?") and len(s.split()) >= 5]
    if not candidates:
        return []
    freq = Counter()
    for sentence in candidates:
        freq.update(_content_words(sentence))
    scored = []
    for i, sentence in enumerate(candidates):
        words = _content_words(sentence)
        if not words:
            continue
        score = sum(freq[w] for w in words) / (len(words) ** 0.5)
        scored.append((score, i, sentence))
    scored.sort(key=lambda item: (-item[0], item[1]))
    chosen = sorted(scored[:top_n], key=lambda item: item[1])
    return [sentence for _, _, sentence in chosen]


def _temas(sentences: list[str], top_n: int = 6) -> list[dict]:
    freq = Counter()
    for sentence in sentences:
        freq.update(set(_content_words(sentence)))
    temas = []
    for word, count in freq.most_common(top_n):
        if count < 1:
            continue
        ejemplos = [s for s in sentences if word in s.lower()][:2]
        ejemplos = [e if len(e) <= 140 else e[:137] + "…" for e in ejemplos]
        temas.append({"tema": word, "menciones": count, "ejemplos": ejemplos})
    return temas


def _find_fecha(sentence: str) -> str | None:
    # Prioridad: frases completas como "antes del X"
    match = re.search(r"\bantes del [a-záéíóúñ ]{1,25}", sentence, re.IGNORECASE)
    if match:
        return match.group(0).strip()
    
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, sentence, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


def _find_responsable(sentence: str, speaker: str | None, attendees: list[str]) -> str | None:
    match = re.search(
        r"\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+(se encarga|lo hace|lo revisa|lo envía|lo prepara)\b",
        sentence,
    )
    if match:
        return match.group(1)
    lowered = sentence.lower()
    for person in attendees:
        first = person.strip().split()[0]
        if first and re.search(r"\b" + re.escape(first.lower()) + r"\b", lowered):
            return person
    # Solo el propio hablante se asigna: "yo + verbo" o "me encargo/me toca".
    # Pero ignorar si la frase contiene "preparar" explícitamente, ya que suele ser delegación.
    # Además, ignorar si la frase es una delegación general ("que alguien...").
    if speaker and "preparar" not in sentence.lower() and "que alguien" not in sentence.lower() and (COMMITMENT_RE.search(sentence) or re.search(r"\bme (encargo|toca)\b", lowered)):
        return speaker
    return None


def _dedupe_names(names: list[str]) -> list[str]:
    """Quita repetidos ignorando mayúsculas y espacios; conserva el primero."""
    seen, result = set(), []
    for name in names:
        clean = " ".join((name or "").split())
        key = clean.casefold()
        if clean and key not in seen:
            seen.add(key)
            result.append(clean)
    return result


def _match_any(sentence: str, patterns: list[str]) -> bool:
    return any(re.search(p, sentence, re.IGNORECASE) for p in patterns)


def analyze(text: str, attendees: list[str] | None = None) -> dict:
    """Devuelve los apuntes de una transcripción.

    Lanza ValueError si la transcripción está vacía.
    """
    attendees = attendees or []
    if not text or not text.strip():
        raise ValueError("La transcripción está vacía.")
    utterances = parse_transcript(text)
    if not utterances:
        raise ValueError("La transcripción está vacía.")

    all_text = " ".join(u["text"] for u in utterances)
    sentences = _split_sentences(all_text)
    participantes = _dedupe_names(
        [u["speaker"] for u in utterances if u["speaker"]] + list(attendees)
    )

    decisiones, pendientes, preguntas = [], [], []
    seen_decisions, seen_actions = set(), set()

    # Las frases se evalúan con su hablante para asignar responsables.
    flat: list[tuple[str, str | None]] = []
    for u in utterances:
        for sentence in _split_sentences(u["text"]):
            flat.append((sentence, u["speaker"]))

    for sentence, speaker in flat:
        is_question = sentence.endswith("?") or bool(REPORTED_QUESTION_RE.search(sentence))
        if is_question:
            preguntas.append(sentence)
            continue
        if _match_any(sentence, DECISION_PATTERNS):
            key = sentence.lower()
            if key not in seen_decisions:
                seen_decisions.add(key)
                decisiones.append({"texto": sentence, "hablante": speaker})
        is_action = (
            _match_any(sentence, ACTION_PATTERNS)
            or re.match(TASK_VERB_START, sentence, re.IGNORECASE)
            or (COMMITMENT_RE.search(sentence) and _find_fecha(sentence))
        )
        
        # Filtro de ruido: no frases de apertura, contexto o resumen/cierre.
        if is_action:
            if _match_any(sentence, [r"\b(Partimos|Lo primero|cerramos)\b"]):
                continue

            # Manejar delegación + revisión en la misma frase: dividir por coma
            parts = [sentence]
            if "," in sentence:
                parts = [p.strip() for p in sentence.split(",")]

            for part in parts:
                if len(part) < 5: continue
                # Solo añadir si parece una acción o si es el primer fragmento (la delegación)
                key = part.lower()
                if key not in seen_actions:
                    seen_actions.add(key)
                    # Si es la parte de "reviso", ignorar
                    if "reviso" in key and "prepare" not in key and len(parts) > 1:
                        continue

                    # Buscar fecha en el contexto si no está en la frase
                    fecha = _find_fecha(part) or _find_fecha(sentence)
                    if not fecha:
                        # Buscar fecha en las siguientes frases si se refiere al mismo tema
                        for next_sentence in sentences[sentences.index(sentence)+1:]:
                            # Si detectamos una fecha futura o específica, usarla
                            if _find_fecha(next_sentence):
                                fecha = _find_fecha(next_sentence)
                                break

                    pendientes.append(
                        {
                            "texto": part,
                            "responsable": _find_responsable(part, speaker, attendees),
                            "fecha": fecha,
                            "hecho": False,
                        }
                    )

    # Heredar fecha si comparten una palabra de contenido clave y otra frase sí tiene fecha (cierre)
    for p in pendientes:
        if not p.get("fecha"):
            p_words = set(_content_words(p["texto"]))
            for s, _ in flat:
                s_fecha = _find_fecha(s)
                if s_fecha:
                    s_words = set(_content_words(s))
                    if p_words & s_words:
                        p["fecha"] = s_fecha
                        break

    return {
        "resumen": _resumen(sentences),
        "temas": _temas(sentences),
        "decisiones": decisiones,
        "pendientes": pendientes,
        "preguntas": preguntas,
        "participantes": participantes,
        "total_intervenciones": len(utterances),
    }


# ---------------------------------------------------------------------------
# Exportación a Markdown
# ---------------------------------------------------------------------------


def to_markdown(title: str, date: str, notes: dict) -> str:
    lines = [f"# {title}", ""]
    if date:
        lines.append(f"**Fecha:** {date}")
    if notes.get("participantes"):
        lines.append(f"**Participantes:** {', '.join(notes['participantes'])}")
    lines.append("")

    if notes.get("resumen"):
        lines.append("## Resumen")
        lines.append("")
        for sentence in notes["resumen"]:
            lines.append(f"- {sentence}")
        lines.append("")

    if notes.get("temas"):
        lines.append("## Temas tratados")
        lines.append("")
        for tema in notes["temas"]:
            lines.append(f"- **{tema['tema']}** ({tema['menciones']} menciones)")
        lines.append("")

    if notes.get("decisiones"):
        lines.append("## Decisiones")
        lines.append("")
        for d in notes["decisiones"]:
            extra = f" — {d['hablante']}" if d.get("hablante") else ""
            lines.append(f"- {d['texto']}{extra}")
        lines.append("")

    if notes.get("pendientes"):
        lines.append("## Pendientes")
        lines.append("")
        for p in notes["pendientes"]:
            check = "x" if p.get("hecho") else " "
            extra = ""
            if p.get("responsable"):
                extra += f" — Responsable: {p['responsable']}"
            if p.get("fecha"):
                extra += f" — Fecha: {p['fecha']}"
            lines.append(f"- [{check}] {p['texto']}{extra}")
        lines.append("")

    if notes.get("preguntas"):
        lines.append("## Preguntas abiertas")
        lines.append("")
        for q in notes["preguntas"]:
            lines.append(f"- {q}")
        lines.append("")

    lines.append("---")
    lines.append("_Generado con Minuta. Usa solo grabaciones hechas con aviso a los participantes._")
    return "\n".join(lines)
