import { useState, useEffect } from 'react';
import { getMeetings, getMeeting, updateMeeting, deleteMeeting, createMeeting, analyzeTranscript } from '../lib/api';
import { generateMarkdown } from '../lib/markdown';
import { formatDate, matchesQuery, inRange, withTimeout, downloadText } from '../lib/utils';
import PrintPreview from './PrintPreview';
import LoadingOverlay from './LoadingOverlay';
import ConfirmDialog from './ConfirmDialog';

const sectionTitle = 'font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider';
const btn = 'text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium disabled:opacity-50';
const input = 'w-full rounded border border-purple-200 p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

// Lista de minutas guardadas y vista de una minuta (solo lectura o editable).
export default function HistorialView() {
  const [meetings, setMeetings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null); // { message, label, danger, action }
  const [range, setRange] = useState('todas');
  const [editing, setEditing] = useState(null); // copia de notes mientras se edita
  const [busy, setBusy] = useState(null); // paso del overlay o null

  useEffect(() => {
    getMeetings()
      .then(setMeetings)
      .catch((err) => setError(err.message));
  }, []);

  const open = async (id) => {
    setError(null);
    try {
      setSelected(await getMeeting(id));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportMarkdown = () => {
    const { title, date, notes } = selected;
    downloadText(`${title.replace(/\s+/g, '_')}_minuta.md`, generateMarkdown(title, date, notes));
  };

  // La lista no trae notes: se piden todas las minutas completas antes de exportar.
  const exportAll = async () => {
    setError(null);
    try {
      const full = await Promise.all(meetings.map((m) => getMeeting(m.id)));
      const md = full
        .map((m) => generateMarkdown(m.title, m.date, { ...m.notes, participantes: m.attendees }))
        .join('\n\n');
      downloadText('minutas_todas.md', md);
    } catch (err) {
      setError(err.message);
    }
  };

  // Guarda notas con PUT. Si falla, se queda en edición con los cambios intactos.
  const saveNotes = async (notes) => {
    setError(null);
    try {
      setSelected(await updateMeeting(selected.id, { notes }));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePending = (i) => {
    const pendientes = selected.notes.pendientes.map((p, j) => (j === i ? { ...p, hecho: !p.hecho } : p));
    saveNotes({ ...selected.notes, pendientes });
  };

  const askRegenerate = () => setConfirm({
    message: 'Re-generar reemplaza los apuntes actuales, incluidas tus ediciones. ¿Continuar?',
    label: 'Re-generar',
    action: regenerate,
  });

  const regenerate = async () => {
    setError(null);
    setBusy('Generando apuntes...');
    try {
      const notes = await withTimeout(analyzeTranscript(selected.transcript, selected.attendees, selected.date), 'análisis');
      setSelected(await updateMeeting(selected.id, { notes }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (id) => setConfirm({
    message: '¿Eliminar esta minuta? Esta acción no se puede deshacer.',
    label: 'Eliminar',
    danger: true,
    action: () => doRemove(id),
  });

  const doRemove = async (id) => {
    setError(null);
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const duplicate = async (id) => {
    setError(null);
    try {
      const m = await getMeeting(id);
      const copy = await createMeeting({
        title: `${m.title} (copia)`,
        date: m.date,
        attendees: m.attendees,
        transcript: m.transcript,
        notes: m.notes,
      });
      setMeetings((prev) => [copy, ...prev]);
    } catch (err) {
      setError(err.message);
    }
  };

  // Cambia un campo de una lista (resumen, decisiones...) dentro de la copia en edición.
  const setItem = (section, i, value) => {
    const list = [...editing[section]];
    list[i] = value;
    setEditing({ ...editing, [section]: list });
  };
  const removeItem = (section, i) => setEditing({ ...editing, [section]: editing[section].filter((_, j) => j !== i) });

  const filtered = (meetings || []).filter((m) => matchesQuery(m, query) && inRange(m.date, range));

  const errorBox = error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  const confirmBox = confirm && (
    <ConfirmDialog
      message={confirm.message}
      confirmLabel={confirm.label}
      danger={confirm.danger}
      onCancel={() => setConfirm(null)}
      onConfirm={() => { const { action } = confirm; setConfirm(null); action(); }}
    />
  );

  if (selected) {
    const notes = selected.notes || {};
    const view = editing || notes;
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
        <LoadingOverlay step={busy} />
        {confirmBox}
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
            {editing ? (
              <>
                <button onClick={() => saveNotes(editing)} className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 font-medium">Guardar cambios</button>
                <button onClick={() => { setEditing(null); setError(null); }} className={btn}>Cancelar</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(structuredClone(notes))} className={btn}>Editar</button>
                <button onClick={() => setShowPrint(true)} className={btn}>Vista previa</button>
                <button onClick={() => setShowPrint('print')} className={btn}>Exportar PDF</button>
                <button onClick={exportMarkdown} className={btn}>Descargar .md</button>
                <button onClick={askRegenerate} disabled={!selected.transcript} className={btn}>Re-generar apuntes</button>
                <button onClick={() => remove(selected.id)} className="text-sm text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 font-medium">Eliminar</button>
              </>
            )}
          </div>
        </div>

        {showPrint && (
          <PrintPreview
            title={selected.title}
            date={selected.date}
            attendees={selected.attendees}
            notes={notes}
            onClose={() => setShowPrint(false)} autoPrint={showPrint === 'print'}
          />
        )}

        {errorBox}

        {(editing || view.resumen?.length > 0) && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Resumen</h3>
            {editing ? (
              view.resumen?.map((r, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={input} value={r} onChange={(e) => setItem('resumen', i, e.target.value)} />
                  <button onClick={() => removeItem('resumen', i)} className="text-red-500 px-2">×</button>
                </div>
              ))
            ) : (
              <ul className="list-disc pl-5 text-sm">{view.resumen.map((r, i) => <li key={i}>{r}</li>)}</ul>
            )}
          </div>
        )}

        {(editing || view.temas?.length > 0) && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Temas tratados</h3>
            {editing ? (
              view.temas?.map((t, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={input} value={t.tema} onChange={(e) => setItem('temas', i, { ...t, tema: e.target.value })} />
                  <button onClick={() => removeItem('temas', i)} className="text-red-500 px-2">×</button>
                </div>
              ))
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {view.temas.map((t, i) => <li key={i}>{t.tema} <span className="text-gray-500">({t.menciones} menciones)</span></li>)}
              </ul>
            )}
          </div>
        )}

        {(editing || view.decisiones?.length > 0) && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Decisiones</h3>
            {editing ? (
              view.decisiones?.map((d, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={input} value={d.texto} onChange={(e) => setItem('decisiones', i, { ...d, texto: e.target.value })} />
                  <input className="w-32 rounded border border-purple-200 p-1.5 text-xs" value={d.hablante || ''} placeholder="Hablante"
                    onChange={(e) => setItem('decisiones', i, { ...d, hablante: e.target.value })} />
                  <button onClick={() => removeItem('decisiones', i)} className="text-red-500 px-2">×</button>
                </div>
              ))
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {view.decisiones.map((d, i) => <li key={i}>{d.texto} {d.hablante && <span className="text-gray-500">— {d.hablante}</span>}</li>)}
              </ul>
            )}
          </div>
        )}

        {(editing || view.pendientes?.length > 0) && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Pendientes</h3>
            {editing ? (
              view.pendientes?.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={input} value={p.texto} placeholder="Descripción de la tarea"
                    onChange={(e) => setItem('pendientes', i, { ...p, texto: e.target.value })} />
                  <input className="w-28 rounded border border-purple-200 p-1.5 text-xs" value={p.responsable || ''} placeholder="Responsable"
                    onChange={(e) => setItem('pendientes', i, { ...p, responsable: e.target.value })} />
                  <input className="w-32 rounded border border-purple-200 p-1.5 text-xs" value={p.fecha || ''} placeholder="Fecha"
                    onChange={(e) => setItem('pendientes', i, { ...p, fecha: e.target.value })} />
                  <button onClick={() => removeItem('pendientes', i)} className="text-red-500 px-2">×</button>
                </div>
              ))
            ) : (
              <ul className="text-sm space-y-1">
                {view.pendientes.map((p, i) => (
                  <li key={i} className={p.hecho ? 'text-gray-400' : ''}>
                    <button onClick={() => togglePending(i)} className="mr-1 text-lg leading-none" title="Marcar como hecho">
                      {p.hecho ? '☑' : '☐'}
                    </button>
                    <span className={p.hecho ? 'line-through' : ''}>{p.texto}</span>
                    {p.responsable && <span className="text-gray-500"> — Responsable: {p.responsable}</span>}
                    {p.fecha && <span className="text-gray-500"> — Fecha: {p.fecha}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(editing || view.preguntas?.length > 0) && (
          <div className="mb-4">
            <h3 className={sectionTitle}>Preguntas abiertas</h3>
            {editing ? (
              view.preguntas?.map((q, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className={input} value={q} onChange={(e) => setItem('preguntas', i, e.target.value)} />
                  <button onClick={() => removeItem('preguntas', i)} className="text-red-500 px-2">×</button>
                </div>
              ))
            ) : (
              <ul className="list-disc pl-5 text-sm">{view.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
      <LoadingOverlay step={busy} />
      {confirmBox}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-purple-900">Minutas guardadas</h2>
        {meetings?.length > 0 && <button onClick={exportAll} className={btn}>Exportar todas</button>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, fecha o participante"
          className="flex-grow rounded-md border border-purple-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-md border border-purple-200 p-2 text-sm">
          <option value="todas">Todas</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
        </select>
      </div>
      {errorBox}
      {meetings === null && !error && <p className="text-sm text-gray-500">Cargando…</p>}
      {meetings?.length === 0 && <p className="text-sm text-gray-500">No hay minutas guardadas todavía</p>}
      {meetings?.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-500">No hay minutas que coincidan con la búsqueda</p>
      )}
      <ul className="divide-y divide-purple-50">
        {filtered.map((m) => (
          <li key={m.id} className="flex items-center gap-2 px-2">
            <button onClick={() => open(m.id)} className="flex-grow text-left py-3 hover:bg-purple-50 px-2 rounded">
              <div className="font-medium text-purple-900">{m.title}</div>
              <div className="text-xs text-gray-500">
                {formatDate(m.date)}{m.attendees?.length > 0 && ` · ${m.attendees.join(', ')}`}
              </div>
            </button>
            <button onClick={() => duplicate(m.id)} className="text-xs text-purple-700 hover:underline">Duplicar</button>
            <button onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
