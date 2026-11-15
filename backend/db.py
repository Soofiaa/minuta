"""Persistencia de Minuta en SQLite (sin dependencias externas).

Una reunión guardada tiene: título, fecha, participantes, transcripción
original y los apuntes generados (JSON). SQLite alcanza para el uso
personal y el portafolio; si el proyecto crece, este módulo es el único
que cambia para pasar a PostgreSQL/Supabase.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT,
    attendees TEXT NOT NULL DEFAULT '[]',
    transcript TEXT NOT NULL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _connect(db_path: str | Path):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return closing(conn)


def init_db(db_path: str | Path) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with _connect(db_path) as conn:
        with conn:
            conn.executescript(SCHEMA)


def _row_to_meeting(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "date": row["date"],
        "attendees": json.loads(row["attendees"]),
        "transcript": row["transcript"],
        "notes": json.loads(row["notes"]),
        "created_at": row["created_at"],
    }


def create_meeting(db_path, title, date, attendees, transcript, notes) -> dict:
    with _connect(db_path) as conn:
        with conn:
            cursor = conn.execute(
                "INSERT INTO meetings (title, date, attendees, transcript, notes)"
                " VALUES (?, ?, ?, ?, ?)",
                (
                    title,
                    date,
                    json.dumps(attendees, ensure_ascii=False),
                    transcript,
                    json.dumps(notes, ensure_ascii=False),
                ),
            )
            meeting_id = cursor.lastrowid
    return get_meeting(db_path, meeting_id)


def list_meetings(db_path) -> list[dict]:
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, title, date, attendees, created_at FROM meetings"
            " ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "date": row["date"],
            "attendees": json.loads(row["attendees"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def get_meeting(db_path, meeting_id: int) -> dict | None:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM meetings WHERE id = ?", (meeting_id,)
        ).fetchone()
    return _row_to_meeting(row) if row else None


def update_meeting(db_path, meeting_id: int, **fields) -> dict | None:
    allowed = {"title", "date", "attendees", "transcript", "notes"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_meeting(db_path, meeting_id)
    if "attendees" in updates:
        updates["attendees"] = json.dumps(updates["attendees"], ensure_ascii=False)
    if "notes" in updates:
        updates["notes"] = json.dumps(updates["notes"], ensure_ascii=False)
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with _connect(db_path) as conn:
        with conn:
            conn.execute(
                f"UPDATE meetings SET {assignments} WHERE id = ?",
                (*updates.values(), meeting_id),
            )
    return get_meeting(db_path, meeting_id)


def delete_meeting(db_path, meeting_id: int) -> bool:
    with _connect(db_path) as conn:
        with conn:
            cursor = conn.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
            return cursor.rowcount > 0
