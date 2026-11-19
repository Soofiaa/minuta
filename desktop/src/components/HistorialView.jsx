import { useState, useEffect } from 'react';
import { getMeetings, getMeeting } from '../lib/api';
import { generateMarkdown } from '../lib/markdown';
import PrintPreview from './PrintPreview';

const sectionTitle = 'font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider';

// "2026-11-18" -> "18/11/2026". Si no tiene ese formato, se muestra tal cual.
const formatDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value || 'No especificada';
};

// Lista de minutas guardadas y vista de solo lectura de una minuta.
export default function HistorialView() {
  const [meetings, setMeetings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    getMeetings()
      .then(setMeetings)
      .catch((err) => setError(err.message));
  }, []);

  const open = async (id) => {
    setError(null);
    try {
      setSelected(await getMeeting(id));
    } catch (err) {
      setError(err.message);
    }
  };

  const exportMarkdown = () => {
    const { title, date, notes } = selected;
    const blob = new Blob([generateMarkdown(title, date, notes)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_minuta.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorBox = error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  if (selected) {
    const { notes = {} } = selected;
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <button onClick={() => setSelected(null)} className="text-sm text-purple-600 hover:underline mb-2">
              ← Volver al historial
            </button>
            <h2 className="text-2xl font-bold text-purple-900">{selected.title}</h2>
            <p className="text-sm text-gray-500">Fecha: {formatDate(selected.date)}</p>
            {selected.attendees?.length > 0 && (
              <p className="text-sm text-gray-500">Participantes: {selected.attendees.join(', ')}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowPrint(true)} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium">
              Vista previa
            </button>
            <button onClick={() => window.print()} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium">
              Exportar PDF
            </button>
            <button onClick={exportMarkdown} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium">
              Descargar .md
            </button>
          </div>
        </div>

        {showPrint && (
          <PrintPreview
            title={selected.title}
            date={selected.date}
            attendees={selected.attendees}
            notes={notes}
            onClose={() => setShowPrint(false)}
          />
        )}

        {errorBox}

        {notes.resumen?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Resumen</h3>
            <ul className="list-disc pl-5 text-sm">{notes.resumen.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}

        {notes.temas?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Temas tratados</h3>
            <ul className="list-disc pl-5 text-sm">
              {notes.temas.map((t, i) => <li key={i}>{t.tema} <span className="text-gray-500">({t.menciones} menciones)</span></li>)}
            </ul>
          </div>
        )}

        {notes.decisiones?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Decisiones</h3>
            <ul className="list-disc pl-5 text-sm">
              {notes.decisiones.map((d, i) => <li key={i}>{d.texto} {d.hablante && <span className="text-gray-500">— {d.hablante}</span>}</li>)}
            </ul>
          </div>
        )}

        {notes.pendientes?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Pendientes</h3>
            <ul className="text-sm space-y-1">
              {notes.pendientes.map((p, i) => (
                <li key={i} className={p.hecho ? 'line-through text-gray-400' : ''}>
                  {p.hecho ? '☑' : '☐'} {p.texto}
                  {p.responsable && <span className="text-gray-500"> — Responsable: {p.responsable}</span>}
                  {p.fecha && <span className="text-gray-500"> — Fecha: {p.fecha}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes.preguntas?.length > 0 && (
          <div className="mb-4">
            <h3 className={sectionTitle}>Preguntas abiertas</h3>
            <ul className="list-disc pl-5 text-sm">{notes.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
      <h2 className="mb-4 text-xl font-semibold text-purple-900">Minutas guardadas</h2>
      {errorBox}
      {meetings === null && !error && <p className="text-sm text-gray-500">Cargando…</p>}
      {meetings?.length === 0 && <p className="text-sm text-gray-500">No hay minutas guardadas todavía</p>}
      <ul className="divide-y divide-purple-50">
        {meetings?.map((m) => (
          <li key={m.id}>
            <button onClick={() => open(m.id)} className="w-full text-left py-3 hover:bg-purple-50 px-2 rounded">
              <div className="font-medium text-purple-900">{m.title}</div>
              <div className="text-xs text-gray-500">
                {formatDate(m.date)}{m.attendees?.length > 0 && ` · ${m.attendees.join(', ')}`}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
