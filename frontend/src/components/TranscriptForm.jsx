import { useState } from 'react';
import { sampleTranscript } from '../lib/sampleTranscript';
import { transcribeAudio } from '../lib/api';

const field = 'w-full rounded-md border border-purple-200 p-2 focus:outline-none focus:ring-2 focus:ring-purple-500';

export default function TranscriptForm({ onAnalyze, onError, loading }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendeesStr, setAttendeesStr] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const handleSample = () => {
    setTitle('Reunión de Planificación Frontend');
    setAttendeesStr('Sofia, Pedro, María');
    setTranscript(sampleTranscript);
  };

  const handleTextFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setTranscript(event.target.result);
    reader.readAsText(file);
  };

  const handleAudio = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setTranscribing(true);
    onError(null);
    try {
      const res = await transcribeAudio(file);
      setTranscript(res.transcript);
    } catch (err) {
      onError(err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return onError('Indica un título para la reunión.');
    if (!transcript.trim()) return onError('La transcripción está vacía.');
    const attendees = attendeesStr.split(',').map((s) => s.trim()).filter(Boolean);
    onAnalyze({ title: title.trim(), date, attendees, transcript });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-purple-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-purple-900">Nueva minuta</h2>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Título de la reunión
          <input type="text" className={`${field} mt-1`} value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sprint Planning" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Fecha
          <input type="date" className={`${field} mt-1`} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <label className="mb-4 block text-sm font-medium text-gray-700">
        Participantes (separados por coma)
        <input type="text" className={`${field} mt-1`} value={attendeesStr}
          onChange={(e) => setAttendeesStr(e.target.value)} placeholder="Sofia, Pedro, María" />
      </label>

      <div className="mb-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-gray-700">Transcripción</span>
          <div className="flex gap-3 text-purple-700">
            <label className="cursor-pointer hover:underline">
              Subir texto (.txt/.md/.vtt/.srt)
              <input type="file" accept=".txt,.md,.vtt,.srt" onChange={handleTextFile} className="hidden" />
            </label>
            <label className={`cursor-pointer hover:underline ${transcribing ? 'opacity-50' : ''}`}>
              {transcribing ? 'Transcribiendo audio…' : 'Subir audio (.mp3/.wav/.m4a/.webm)'}
              <input type="file" accept=".mp3,.wav,.m4a,.webm,audio/*" onChange={handleAudio}
                className="hidden" disabled={transcribing} />
            </label>
          </div>
        </div>
        <textarea rows={8} className={`${field} font-mono text-sm`} value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Pega aquí la transcripción o súbela…" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={handleSample}
          className="rounded-md border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100">
          Probar con un ejemplo
        </button>
        <button type="submit" disabled={loading || transcribing}
          className="rounded-md bg-purple-600 px-6 py-2 font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50">
          {loading ? 'Generando…' : 'Generar apuntes'}
        </button>
      </div>
    </form>
  );
}
