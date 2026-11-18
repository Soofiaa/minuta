import pytest
from notes_engine import analyze

def test_sprint_full_transcript():
    text = """Sofia: Partimos con la planificación de la app de reservas.
Pedro: Que alguien prepare el correo para el cliente antes del jueves.
Pedro: Revisar base de datos.
Sofia: Actualizar servidor.
Sofia: Subir cambios a producción.
Sofia: Enviar informe final.
Sofia: Entonces cerramos: reservas lista el viernes."""
    attendees = ["Sofia", "Pedro"]
    notes = analyze(text, attendees)
    
    assert len(notes["pendientes"]) == 5
    
    correo_pendientes = [p for p in notes["pendientes"] if "correo" in p["texto"].lower()]
    assert len(correo_pendientes) == 1
    assert correo_pendientes[0]["fecha"] == "antes del jueves"
    assert correo_pendientes[0]["responsable"] is None

def test_online_store_full_transcript():
    text = """Ana: Partimos con la planificación de la tienda online.
Ana: Lo primero es el diseño de productos.
Carlos: Que alguien suba el catálogo antes del viernes.
Carlos: Revisar envíos.
Carlos: Actualizar pagos.
Carlos: Preparar fotos.
Carlos: Entregar informes.
Ana: Entonces cerramos: catálogo listo el viernes, fotos antes del jueves, pagos el miércoles, envíos el lunes."""
    attendees = ["Ana", "Carlos"]
    notes = analyze(text, attendees)
    
    assert len(notes["pendientes"]) == 5
    
    cat_pendientes = [p for p in notes["pendientes"] if "catálogo" in p["texto"].lower()]
    assert len(cat_pendientes) == 1
    assert cat_pendientes[0]["fecha"] == "antes del viernes"
    assert cat_pendientes[0]["responsable"] is None
