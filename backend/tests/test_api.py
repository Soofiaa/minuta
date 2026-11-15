import pytest
import os
import io
import json
from app import create_app

@pytest.fixture
def app():
    # Usar una base de datos temporal
    os.environ["DATABASE_PATH"] = "test_minuta.db"
    # Asegurar que no se use Postgres en tests
    os.environ["DATABASE_URL"] = ""
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    yield app
    # Limpiar
    if os.path.exists("test_minuta.db"):
        os.remove("test_minuta.db")

@pytest.fixture
def client(app):
    return app.test_client()

def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok"}

def test_analyze(client):
    data = {
        "transcript": "Sofia: Decidimos usar React.\nPedro: Me encargo de revisar el diseño antes del viernes.",
        "attendees": ["Sofia", "Pedro"]
    }
    response = client.post("/api/analyze", json=data)
    assert response.status_code == 200
    result = response.json
    assert "resumen" in result
    assert len(result["decisiones"]) == 1
    assert len(result["pendientes"]) == 1

def test_meetings_crud(client):
    # Crear
    meeting_data = {
        "title": "Reunión de prueba",
        "date": "2026-11-13",
        "attendees": ["Sofia", "Pedro"],
        "transcript": "Sofia: Decidimos usar React.",
        "notes": {"resumen": ["Decidimos usar React."]}
    }
    response = client.post("/api/meetings", json=meeting_data)
    assert response.status_code == 201
    meeting_id = response.json["id"]
    
    # Listar
    response = client.get("/api/meetings")
    assert response.status_code == 200
    assert len(response.json) == 1
    
    # Obtener
    response = client.get(f"/api/meetings/{meeting_id}")
    assert response.status_code == 200
    assert response.json["title"] == "Reunión de prueba"
    
    # Actualizar
    update_data = {"title": "Reunión actualizada"}
    response = client.put(f"/api/meetings/{meeting_id}", json=update_data)
    assert response.status_code == 200
    assert response.json["title"] == "Reunión actualizada"
    
    # Eliminar
    response = client.delete(f"/api/meetings/{meeting_id}")
    assert response.status_code == 204
    
    # Verificar eliminación
    response = client.get(f"/api/meetings/{meeting_id}")
    assert response.status_code == 404

def test_transcription_status(client, monkeypatch):
    monkeypatch.setenv("TRANSCRIPTION_PROVIDER", "groq")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    response = client.get("/api/transcription/status")
    assert response.status_code == 200
    body = response.json
    assert set(body) == {"provider", "configured", "message"}
    assert body["provider"] == "groq"
    assert body["configured"] is False
    assert "GROQ_API_KEY" in body["message"]

def test_transcribe_no_file(client):
    response = client.post("/api/transcribe")
    assert response.status_code == 400
    assert "error" in response.json
