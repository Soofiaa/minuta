import React, { useState, useEffect } from 'react';
import TranscriptForm from './components/TranscriptForm';
import NotesView from './components/NotesView';
import HistoryList from './components/HistoryList';
import {
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  analyzeTranscript,
} from './lib/api';

export default function App() {
  const [meeting, setMeeting] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await listMeetings();
      setHistory(data || []);
    } catch (e) {
      // Silenciar errores al cargar historial (puede ser que no existan aún)
      setHistory([]);
    }
  };

  const handleAnalyze = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const notes = await analyzeTranscript(formData.transcript, formData.attendees);
      setMeeting({ ...formData, notes });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (notes) => {
    setLoading(true);
    setError(null);
    try {
      if (meeting.id) {
        // Actualizar reunión existente
        await updateMeeting(meeting.id, { ...meeting, notes });
      } else {
        // Crear nueva reunión
        await createMeeting({ ...meeting, notes });
      }
      setMeeting(null);
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMeeting = async (id) => {
    setError(null);
    try {
      const m = await getMeeting(id);
      setMeeting(m);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteMeeting = async (id) => {
    setError(null);
    try {
      await deleteMeeting(id);
      loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex flex-col lg:flex-row">
      {/* Sidebar */}
      <HistoryList history={history} onLoad={handleLoadMeeting} onDelete={handleDeleteMeeting} />

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Banner de consentimiento */}
        <div className="bg-purple-100 border-b-2 border-purple-200 p-4 text-center">
          <p className="text-sm font-medium text-purple-900">
            ⚠️ Usa Minuta solo con grabaciones o transcripciones hechas con aviso a todas las personas de la reunión.
          </p>
        </div>

        {/* Área de contenido */}
        <div className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!meeting ? (
            <TranscriptForm onAnalyze={handleAnalyze} onError={setError} loading={loading} />
          ) : (
            <NotesView
              title={meeting.title}
              date={meeting.date}
              notes={meeting.notes}
              onSave={handleSave}
              onBack={() => setMeeting(null)}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-purple-100 bg-purple-50/30 py-4 px-6 text-center text-xs text-gray-500">
          Tus apuntes se generan en tu propio backend; nada se sube salvo el audio que tú decides transcribir.
        </footer>
      </main>
    </div>
  );
}
