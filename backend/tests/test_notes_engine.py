import pytest
from notes_engine import analyze, to_markdown, clean_transcript_text

def test_clean_transcript_text():
    vtt = """WEBVTT

00:00:01.000 --> 00:00:04.000
Hola a todos

00:00:05.000 --> 00:00:08.000
Esto es una prueba
"""
    cleaned = clean_transcript_text(vtt)
    assert "Hola a todos" in cleaned
    assert "Esto es una prueba" in cleaned
    assert "WEBVTT" not in cleaned
    assert "00:00:01" not in cleaned

def test_analyze_logic():
    text = """Sofia: Decidimos usar React.
Pedro: Me encargo de revisar el diseño antes del viernes.
Sofia: ¿Alguien tiene dudas?
"""
    attendees = ["Sofia", "Pedro"]
    notes = analyze(text, attendees)
    
    assert len(notes["decisiones"]) == 1
    assert "React" in notes["decisiones"][0]["texto"]
    
    assert len(notes["pendientes"]) == 1
    assert notes["pendientes"][0]["responsable"] == "Pedro"
    assert notes["pendientes"][0]["fecha"] == "antes del viernes"
    
    assert len(notes["preguntas"]) == 1
    assert "dudas" in notes["preguntas"][0]

def test_first_person_commitment_with_future_is_pending():
    text = """Lucía: Yo reviso los permisos y les confirmo el miércoles.
Mario: Yo lo pruebo mañana en la mañana.
"""
    notes = analyze(text, ["Lucía", "Mario"])
    pendientes = {p["texto"]: p for p in notes["pendientes"]}
    assert len(pendientes) == 2
    lucia = next(p for p in notes["pendientes"] if "permisos" in p["texto"])
    assert lucia["responsable"] == "Lucía"
    assert lucia["fecha"] == "el miércoles"
    mario = next(p for p in notes["pendientes"] if "pruebo" in p["texto"])
    assert mario["responsable"] == "Mario"
    assert mario["fecha"] == "mañana"

def test_question_goes_to_preguntas_not_pendientes():
    text = """Ana: Ana pregunta si el buscador nuevo va a estar en esta primera versión.
Carlos: ¿Cuándo tenemos la demo?
"""
    notes = analyze(text, ["Ana", "Carlos"])
    assert any("buscador nuevo" in q for q in notes["preguntas"])
    assert any("¿Cuándo tenemos la demo?" in q for q in notes["preguntas"])
    assert all("buscador" not in p["texto"] for p in notes["pendientes"])
    assert all("demo" not in p["texto"] for p in notes["pendientes"])

def test_alguien_leaves_responsable_empty():
    text = "Pablo: Necesito que alguien pruebe la migración antes del viernes.\n"
    notes = analyze(text, ["Pablo"])
    assert len(notes["pendientes"]) == 1
    assert notes["pendientes"][0]["responsable"] is None

def test_nuevo_and_decidimos_are_not_topics():
    text = """Sofia: Decidimos usar un diseño nuevo para la intranet.
Pedro: El diseño nuevo queda para el equipo de producto.
"""
    notes = analyze(text, ["Sofia", "Pedro"])
    temas = {t["tema"] for t in notes["temas"]}
    assert "nuevo" not in temas
    assert "decidimos" not in temas

def test_participantes_dedup_ignores_case_spaces_and_keeps_order():
    text = """Pedro: Revisamos la intranet.
María: Estoy de acuerdo.
"""
    notes = analyze(text, ["  pedro ", "MARÍA", "Ana"])
    assert notes["participantes"] == ["Pedro", "María", "Ana"]

def test_analyze_empty_raises():
    with pytest.raises(ValueError, match="La transcripción está vacía."):
        analyze("")
    with pytest.raises(ValueError, match="La transcripción está vacía."):
        analyze("   ")

def test_to_markdown():
    notes = {
        "resumen": ["Resumen breve."],
        "decisiones": [{"texto": "Decisión A", "hablante": "Sofia"}],
        "participantes": ["Sofia", "Pedro"]
    }
    md = to_markdown("Minuta", "2026-11-13", notes)
    assert "# Minuta" in md
    assert "**Participantes:** Sofia, Pedro" in md
    assert "## Decisiones" in md
    assert "- Decisión A — Sofia" in md

def test_real_transcript_phrase_without_date():
    text = "Pedro: Que alguien prepare el correo para el cliente, yo lo reviso antes de enviarlo."
    attendees = ["Pedro"]
    notes = analyze(text, attendees)
    
    pendientes = [p for p in notes["pendientes"] if "prepare el correo" in p["texto"]]
    assert len(pendientes) == 1
    assert pendientes[0]["responsable"] is None
    assert pendientes[0]["fecha"] is None

def test_sprint_complete_example():
    text = """Sofia: Partimos con la planificación de la app de reservas.
Sofia: Lo primero es el módulo de reservas online.
Pedro: Que alguien prepare el correo para el cliente, yo lo reviso antes de enviarlo.
Sofia: Entonces cerramos: reservas lista el viernes."""
    attendees = ["Sofia", "Pedro"]
    notes = analyze(text, attendees)
    
    pendientes = notes["pendientes"]
    texts = [p["texto"] for p in pendientes]
    
    # Verify no noise in pendientes (opening, context, closing)
    for t in texts:
        assert "Partimos" not in t
        assert "Lo primero" not in t
        assert "cerramos" not in t
    
    correo_pendientes = [p for p in pendientes if "correo" in p["texto"]]
    assert len(correo_pendientes) == 1
    p = correo_pendientes[0]
    assert p["responsable"] is None
    assert p["fecha"] is None

def test_real_transcript_phrase_without_date():
    text = "Pedro: Que alguien prepare el correo para el cliente, yo lo reviso antes de enviarlo."
    attendees = ["Pedro"]
    notes = analyze(text, attendees)
    
    pendientes = [p for p in notes["pendientes"] if "prepare el correo" in p["texto"]]
    assert len(pendientes) == 1
    assert pendientes[0]["responsable"] is None
    assert pendientes[0]["fecha"] is None

def test_sprint_complete_example():
    text = """Sofia: Partimos con la planificación de la app de reservas.
Sofia: Lo primero es el módulo de reservas online.
Pedro: Que alguien prepare el correo para el cliente, yo lo reviso antes de enviarlo.
Sofia: Entonces cerramos: reservas lista el viernes."""
    attendees = ["Sofia", "Pedro"]
    notes = analyze(text, attendees)
    
    pendientes = notes["pendientes"]
    texts = [p["texto"] for p in pendientes]
    
    # Verify no noise in pendientes (opening, context, closing)
    for t in texts:
        assert "Partimos" not in t
        assert "Lo primero" not in t
        assert "cerramos" not in t
    
    correo_pendientes = [p for p in pendientes if "correo" in p["texto"]]
    assert len(correo_pendientes) == 1
    p = correo_pendientes[0]
    assert p["responsable"] is None
    assert p["fecha"] is None
