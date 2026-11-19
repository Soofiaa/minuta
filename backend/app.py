import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from db import init_db, create_meeting, list_meetings, get_meeting, update_meeting, delete_meeting
from notes_engine import analyze
from transcription import transcribe, provider_status, validate_groq_key, TranscriptionError

def create_app():
    # Load environment variables
    load_dotenv()
    
    app = Flask(__name__)
    CORS(app) # Habilita CORS para el frontend
    
    # DB init
    db_path = os.environ.get("DATABASE_PATH", "minuta.db")
    init_db(db_path)
    
    # Store db_path on app config for route access
    app.config["DATABASE_PATH"] = db_path

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/analyze", methods=["POST"])
    def analyze_route():
        data = request.get_json() or {}
        transcript = data.get("transcript", "")
        if not transcript or not transcript.strip():
            return jsonify({"error": "La transcripción está vacía."}), 400
        
        attendees = data.get("attendees")
        fecha_reunion = data.get("fecha_reunion")
        try:
            result = analyze(transcript, attendees, fecha_reunion=fecha_reunion)
            return jsonify(result)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/transcribe", methods=["POST"])
    def transcribe_route():
        if "audio" not in request.files:
            return jsonify({"error": "Falta el archivo de audio."}), 400
        
        file = request.files["audio"]
        if file.filename == "":
            return jsonify({"error": "Falta el archivo de audio."}), 400
        
        try:
            audio_bytes = file.read()
            filename = file.filename
            provider = os.environ.get("TRANSCRIPTION_PROVIDER", "groq").lower()
            text = transcribe(audio_bytes, filename, groq_key=request.headers.get("X-Groq-Api-Key"))
            return jsonify({"transcript": text, "provider": provider})
        except TranscriptionError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/groq/validate", methods=["POST"])
    def validate_groq_route():
        key = (request.get_json(silent=True) or {}).get("key", "").strip()
        if not key:
            return jsonify({"valid": False, "error": "Falta la clave."}), 400
        try:
            return jsonify({"valid": validate_groq_key(key)})
        except TranscriptionError as exc:
            return jsonify({"valid": False, "error": str(exc)}), 502

    @app.route("/api/transcription/status", methods=["GET"])
    def transcription_status():
        status = provider_status()
        return jsonify(status)

    @app.route("/api/meetings", methods=["POST"])
    def create_meeting_route():
        data = request.get_json() or {}
        title = data.get("title")
        date = data.get("date")
        attendees = data.get("attendees", [])
        transcript = data.get("transcript", "")
        notes = data.get("notes")

        if not title:
            return jsonify({"error": "Falta el título de la reunión."}), 400

        # if notes are not provided, generate them
        if not notes:
            if not transcript or not transcript.strip():
                return jsonify({"error": "La transcripción está vacía para poder generar apuntes automáticamente."}), 400
            try:
                notes = analyze(transcript, attendees)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

        db_file = app.config["DATABASE_PATH"]
        meeting = create_meeting(db_file, title, date, attendees, transcript, notes)
        return jsonify(meeting), 201

    @app.route("/api/meetings", methods=["GET"])
    def list_meetings_route():
        db_file = app.config["DATABASE_PATH"]
        meetings = list_meetings(db_file)
        return jsonify(meetings)

    @app.route("/api/meetings/<int:meeting_id>", methods=["GET"])
    def get_meeting_route(meeting_id):
        db_file = app.config["DATABASE_PATH"]
        meeting = get_meeting(db_file, meeting_id)
        if not meeting:
            return jsonify({"error": "La reunión no existe."}), 404
        return jsonify(meeting)

    @app.route("/api/meetings/<int:meeting_id>", methods=["PUT"])
    def update_meeting_route(meeting_id):
        data = request.get_json() or {}
        db_file = app.config["DATABASE_PATH"]
        
        # Check if it exists
        existing = get_meeting(db_file, meeting_id)
        if not existing:
            return jsonify({"error": "La reunión no existe."}), 404

        title = data.get("title", existing.get("title"))
        date = data.get("date", existing.get("date"))
        attendees = data.get("attendees", existing.get("attendees"))
        transcript = data.get("transcript", existing.get("transcript"))
        notes = data.get("notes", existing.get("notes"))

        meeting = update_meeting(
            db_file, 
            meeting_id, 
            title=title, 
            date=date, 
            attendees=attendees, 
            transcript=transcript, 
            notes=notes
        )
        return jsonify(meeting)

    @app.route("/api/meetings/<int:meeting_id>", methods=["DELETE"])
    def delete_meeting_route(meeting_id):
        db_file = app.config["DATABASE_PATH"]
        success = delete_meeting(db_file, meeting_id)
        if not success:
            return jsonify({"error": "La reunión no existe."}), 404
        return "", 204

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
