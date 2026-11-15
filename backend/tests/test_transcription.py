import pytest
from unittest.mock import patch, MagicMock
import os
from transcription import transcribe, TranscriptionError

@patch("requests.post")
def test_transcribe_groq_success(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"text": "Hola mundo"}
    mock_response.ok = True
    mock_post.return_value = mock_response
    
    with patch.dict(os.environ, {"TRANSCRIPTION_PROVIDER": "groq", "GROQ_API_KEY": "fake_key"}):
        text = transcribe(b"audio_data", "test.mp3")
    
    assert text == "Hola mundo"

def test_transcribe_groq_no_key():
    with patch.dict(os.environ, {"TRANSCRIPTION_PROVIDER": "groq"}, clear=True):
        with pytest.raises(TranscriptionError, match="Falta GROQ_API_KEY"):
            transcribe(b"audio_data", "test.mp3")
