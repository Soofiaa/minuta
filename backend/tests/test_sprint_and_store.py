"""Transcripts completos del sprint y de la tienda online.

NOTA: estos transcripts son reconstrucciones a partir de la descripción de la
reunión, no el audio ni el texto original. Si se dispone de los transcripts
reales, sustituir los textos y mantener las expectativas.

Regla de fechas relativas (ver notes_engine._fecha_absoluta): un día de la
semana es el de la semana (lunes a domingo) que contiene la fecha de la reunión.
"""
from notes_engine import analyze


def _pendiente(notes, fragmento):
    return next(p for p in notes["pendientes"] if fragmento in p["texto"].lower())


def test_sprint_completo_16_11_2026():
    text = """Carlos: Partimos con la planificación del sprint.
Javiera: Me encargo de revisar el diseño de la interfaz.
Diego: Me toca actualizar la base de datos.
Diego: Que alguien prepare el correo para el cliente antes del jueves.
Carlos: Voy a subir los cambios al servidor.
Diego: Revisar los logs de error me toca.
Carlos: Entonces cerramos: diseño listo el martes, base de datos el miércoles, correo antes del jueves, servidor el martes, logs el jueves."""
    notes = analyze(text, ["Carlos", "Javiera", "Diego"], fecha_reunion="2026-11-16")

    assert len(notes["pendientes"]) == 5
    assert not any("cerramos" in p["texto"].lower() for p in notes["pendientes"])

    javiera = _pendiente(notes, "diseño")
    assert javiera["responsable"] == "Javiera"
    assert javiera["fecha"] == "17/11/2026"

    diego_db = _pendiente(notes, "base de datos")
    assert diego_db["responsable"] == "Diego"
    assert diego_db["fecha"] == "18/11/2026"

    correo = _pendiente(notes, "correo")
    assert correo["responsable"] is None
    assert correo["fecha"] == "antes del 19/11/2026"

    carlos = _pendiente(notes, "servidor")
    assert carlos["responsable"] == "Carlos"
    assert carlos["fecha"] == "17/11/2026"

    diego_logs = _pendiente(notes, "logs")
    assert diego_logs["responsable"] == "Diego"
    assert diego_logs["fecha"] == "19/11/2026"


def test_tienda_online_completo_17_11_2026():
    text = """Martina: Partimos con la planificación de la tienda online.
Tomás: Me encargo de revisar los envíos.
Valentina: Voy a actualizar los pagos.
Tomás: Que alguien prepare el comunicado antes del viernes.
Martina: Me toca subir las fotos de productos.
Valentina: Me toca revisar el catálogo.
Martina: Entonces cerramos: envíos listos el lunes, pagos el martes, comunicado antes del viernes, fotos el miércoles, catálogo el jueves."""
    notes = analyze(text, ["Martina", "Tomás", "Valentina"], fecha_reunion="2026-11-17")

    assert len(notes["pendientes"]) == 5
    assert not any("cerramos" in p["texto"].lower() for p in notes["pendientes"])

    # Regla: lunes de la semana de la reunión (17/11 es martes) -> 16/11.
    tomas = _pendiente(notes, "envíos")
    assert tomas["responsable"] == "Tomás"
    assert tomas["fecha"] == "16/11/2026"

    valentina_pagos = _pendiente(notes, "pagos")
    assert valentina_pagos["responsable"] == "Valentina"
    assert valentina_pagos["fecha"] == "17/11/2026"

    comunicado = _pendiente(notes, "comunicado")
    assert comunicado["responsable"] is None
    assert comunicado["fecha"] == "antes del 20/11/2026"

    martina = _pendiente(notes, "fotos")
    assert martina["responsable"] == "Martina"
    assert martina["fecha"] == "18/11/2026"

    valentina_cat = _pendiente(notes, "catálogo")
    assert valentina_cat["responsable"] == "Valentina"
    assert valentina_cat["fecha"] == "19/11/2026"


def test_sin_fecha_de_reunion_no_inventa_fechas():
    text = "Pedro: Que alguien prepare el correo, yo lo reviso antes del jueves."
    notes = analyze(text, ["Pedro"])
    correo = _pendiente(notes, "correo")
    assert correo["fecha"] == "antes del jueves"
