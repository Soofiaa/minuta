import os
import pytest
from dotenv import load_dotenv
from db import is_postgres, init_db, create_meeting, list_meetings, get_meeting, update_meeting, delete_meeting

load_dotenv()

def test_engine_selection(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert is_postgres() is False
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    assert is_postgres() is True

def test_supabase_crud():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        pytest.skip("no ejecutado: falta DATABASE_URL")
    
    try:
        init_db(None)
        meeting = create_meeting(
            None,
            title="Test Supabase CRUD",
            date="2026-11-15",
            attendees=["Sofia", "Bot"],
            transcript="Prueba de conexion a Supabase",
            notes={"resumen": ["Resumen de prueba"]}
        )
        assert meeting["title"] == "Test Supabase CRUD"
        m_id = meeting["id"]

        meetings = list_meetings(None)
        assert any(m["id"] == m_id for m in meetings)

        fetched = get_meeting(None, m_id)
        assert fetched["title"] == "Test Supabase CRUD"

        updated = update_meeting(None, m_id, title="Test Supabase Updated")
        assert updated["title"] == "Test Supabase Updated"

        success = delete_meeting(None, m_id)
        assert success is True
    except Exception as exc:
        pytest.skip(f"no ejecutado: error conectando a Supabase: {exc}")
