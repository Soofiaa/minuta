import { useState, useEffect } from 'react';
import { analyzeTranscript, transcribeAudio, createMeeting } from '../lib/api';
import { generateMarkdown } from '../lib/markdown';
import { formatDate, withTimeout, downloadText } from '../lib/utils';
import PrintPreview from './PrintPreview';
import LoadingOverlay from './LoadingOverlay';

const field = 'w-full rounded-md border border-purple-200 p-2 focus:outline-none focus:ring-2 focus:ring-purple-500';
const sectionTitle = 'font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider';
const removeBtn = 'text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold';
const btn = 'text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium';

// Pantalla de apuntes: pegar transcripción o subir audio, editar y guardar.
// Misma lógica que frontend/src/App.jsx + TranscriptForm + NotesView.
export default function ApuntesView({ recording = null, onClear = null, onViewHistorial = null }) {
  const [title, setTitle] = useState(recording?.title || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendeesStr, setAttendeesStr] = useState('');
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overlayStep, setOverlayStep] = useState(null); // paso mostrado en el overlay; null = oculto
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [stored, setStored] = useState(null); // minuta recién guardada, se muestra en solo lectura

  // Si llega una grabación, procesarla automáticamente
  useEffect(() => {
    if (recording) {
      setTitle(recording.title || recording.windowName || 'Grabación');
      setDate(recording.createdAt ? recording.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      
      const processRecording = async () => {
        setBusy(true);
        setError(null);
        setOverlayStep('Transcribiendo audio...');
        const startTime = Date.now();
        
        try {
          const audioBuffer = await window.electronAPI.getRecordingFile(recording.videoPath);
          console.log(`Archivo: ${audioBuffer.byteLength} bytes`);
          const file = new File([audioBuffer], 'recording.webm', { type: 'video/webm' });
          
          const transcriptPromise = transcribeAudio(file);
          const transcriptData = await Promise.race([
            transcriptPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout en transcripción')), 120000))
          ]);
          console.log(`Transcripción tardó: ${Date.now() - startTime}ms`);
          
          setTranscript(transcriptData.transcript);
          
          setOverlayStep('Generando apuntes...');
          const analyzeStartTime = Date.now();
          const analyzePromise = analyzeTranscript(transcriptData.transcript, [], date);
          
          const result = await Promise.race([
            analyzePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout en análisis')), 120000))
          ]);
          console.log(`Análisis tardó: ${Date.now() - analyzeStartTime}ms`);
          
          setNotes(result);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
          setOverlayStep(null);
        }
      };
      processRecording();
    }
  }, [recording]);

  const handleAudio = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    setOverlayStep('Transcribiendo audio...');
    try {
      const res = await withTimeout(transcribeAudio(file), 'transcripción');
      setTranscript(res.transcript);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setOverlayStep(null);
    }
  };

  const handleTextFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setTranscript(event.target.result);
    reader.readAsText(file);
  };

  const attendees = () => attendeesStr.split(',').map(s => s.trim()).filter(Boolean);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Indica un título para la reunión.');
    if (!transcript.trim()) return setError('La transcripción está vacía.');
    setBusy(true);
    setError(null);
    setSaved(false);
    setStored(null);
    setOverlayStep('Generando apuntes...');
    try {
      const result = await withTimeout(analyzeTranscript(transcript, attendees(), date), 'análisis');
      setNotes(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setOverlayStep(null);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const meeting = await createMeeting({ title: title.trim(), date, attendees: attendees(), transcript, notes });
      setSaved(true);
      setStored(meeting);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([generateMarkdown(title, date, notes)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_minuta.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Imprime desde la vista previa: sin ella el CSS de impresión no tiene qué mostrar.
  const handleExportPDF = () => setShowPrint('print');

  const update = (section, value) => setNotes({ ...notes, [section]: value });
  const edit = (section, index, patch) => {
    const list = [...notes[section]];
    list[index] = { ...list[index], ...patch };
    update(section, list);
  };
  const remove = (section, index) => update(section, notes[section].filter((_, i) => i !== index));

  if (stored) {
    const sn = stored.notes || {};
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-900">{stored.title}</h2>
            <p className="text-sm text-gray-500">Fecha: {formatDate(stored.date)}</p>
            {stored.attendees?.length > 0 && <p className="text-sm text-gray-500">Participantes: {stored.attendees.join(', ')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowPrint(true)} className={btn}>Vista previa</button>
            <button onClick={() => setShowPrint('print')} className={btn}>Exportar PDF</button>
            <button onClick={() => downloadText(`${stored.title.replace(/\s+/g, '_')}_minuta.md`, generateMarkdown(stored.title, stored.date, sn))} className={btn}>Descargar .md</button>
          </div>
        </div>

        {showPrint && (
          <PrintPreview title={stored.title} date={stored.date} attendees={stored.attendees} notes={sn} onClose={() => setShowPrint(false)} autoPrint={showPrint === 'print'} />
        )}

        {sn.resumen?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Resumen</h3>
            <ul className="list-disc pl-5 text-sm">{sn.resumen.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
        {sn.temas?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Temas tratados</h3>
            <ul className="list-disc pl-5 text-sm">
              {sn.temas.map((t, i) => <li key={i}>{t.tema} <span className="text-gray-500">({t.menciones} menciones)</span></li>)}
            </ul>
          </div>
        )}
        {sn.decisiones?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Decisiones</h3>
            <ul className="list-disc pl-5 text-sm">
              {sn.decisiones.map((d, i) => <li key={i}>{d.texto} {d.hablante && <span className="text-gray-500">— {d.hablante}</span>}</li>)}
            </ul>
          </div>
        )}
        {sn.pendientes?.length > 0 && (
          <div className="mb-6">
            <h3 className={sectionTitle}>Pendientes</h3>
            <ul className="text-sm space-y-1">
              {sn.pendientes.map((p, i) => (
                <li key={i} className={p.hecho ? 'line-through text-gray-400' : ''}>
                  {p.hecho ? '☑' : '☐'} {p.texto}
                  {p.responsable && <span className="text-gray-500"> — Responsable: {p.responsable}</span>}
                  {p.fecha && <span className="text-gray-500"> — Fecha: {p.fecha}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {sn.preguntas?.length > 0 && (
          <div className="mb-4">
            <h3 className={sectionTitle}>Preguntas abiertas</h3>
            <ul className="list-disc pl-5 text-sm">{sn.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => { setStored(null); setShowPrint(false); }} className={btn}>Volver a Apuntes</button>
          <button onClick={() => onViewHistorial?.()} className="text-sm bg-purple-600 text-white px-4 py-1.5 rounded-md hover:bg-purple-700 font-medium">Ver en Historial</button>
        </div>
      </div>
    );
  }

  if (notes) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <button onClick={() => { setNotes(null); setSaved(false); }} className="text-sm text-purple-600 hover:underline mb-2">
              ← Volver al formulario
            </button>
            <h2 className="text-2xl font-bold text-purple-900">{title}</h2>
            <p className="text-sm text-gray-500">Fecha: {date || 'No especificada'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportMarkdown} disabled={busy} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium disabled:opacity-50">
              Descargar .md
            </button>
            <button onClick={() => setShowPrint(true)} disabled={busy} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium disabled:opacity-50">
              Vista previa
            </button>
            <button onClick={handleExportPDF} disabled={busy} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium disabled:opacity-50">
              Exportar PDF
            </button>
            <button onClick={handleSave} disabled={busy || saved} className="text-sm bg-purple-600 text-white px-4 py-1.5 rounded-md hover:bg-purple-700 font-medium disabled:opacity-50">
              {saved ? 'Guardada' : 'Guardar minuta'}
            </button>
          </div>
        </div>

        {showPrint && (
          <PrintPreview
            title={title}
            date={date}
            attendees={attendeesStr.split(',').map(s => s.trim()).filter(Boolean)}
            notes={notes}
            onClose={() => setShowPrint(false)} autoPrint={showPrint === 'print'}
          />
        )}

        {error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mb-6">
          <h3 className={sectionTitle}>Resumen</h3>
          {notes.resumen?.map((r, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={`${field} text-sm`} value={r} onChange={(e) => {
                const list = [...notes.resumen]; list[i] = e.target.value; update('resumen', list);
              }} />
              <button onClick={() => remove('resumen', i)} className={removeBtn}>×</button>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className={sectionTitle}>Temas tratados</h3>
          {notes.temas?.map((t, i) => (
            <div key={i} className="mb-2 flex gap-2 items-center">
              <span className="font-medium text-sm">{t.tema}</span>
              <span className="text-xs text-gray-500">({t.menciones} menciones)</span>
              <button onClick={() => remove('temas', i)} className={removeBtn}>×</button>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className={sectionTitle}>Decisiones</h3>
          {notes.decisiones?.map((d, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={`${field} text-sm`} value={d.texto} onChange={(e) => edit('decisiones', i, { texto: e.target.value })} />
              <input className="w-32 border border-gray-200 rounded p-2 text-xs" value={d.hablante || ''}
                onChange={(e) => edit('decisiones', i, { hablante: e.target.value })} placeholder="Hablante" />
              <button onClick={() => remove('decisiones', i)} className={removeBtn}>×</button>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className={sectionTitle}>Pendientes</h3>
          {notes.pendientes?.map((p, i) => (
            <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-100 mb-2">
              <input type="checkbox" checked={!!p.hecho} onChange={() => edit('pendientes', i, { hecho: !p.hecho })}
                className="w-4 h-4" title="Marcar como hecho" />
              <input className={`flex-grow border border-gray-200 rounded p-1.5 text-sm ${p.hecho ? 'line-through text-gray-400' : ''}`}
                value={p.texto} onChange={(e) => edit('pendientes', i, { texto: e.target.value })} placeholder="Descripción de la tarea" />
              <input className="w-28 border border-gray-200 rounded p-1.5 text-xs" value={p.responsable || ''}
                onChange={(e) => edit('pendientes', i, { responsable: e.target.value })} placeholder="Responsable" />
              <input className="w-32 border border-gray-200 rounded p-1.5 text-xs" value={p.fecha || ''}
                onChange={(e) => edit('pendientes', i, { fecha: e.target.value })} placeholder="Fecha" />
              <button onClick={() => remove('pendientes', i)} className={removeBtn}>×</button>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <h3 className={sectionTitle}>Preguntas abiertas</h3>
          {notes.preguntas?.map((q, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={`${field} text-sm`} value={q} onChange={(e) => {
                const list = [...notes.preguntas]; list[i] = e.target.value; update('preguntas', list);
              }} />
              <button onClick={() => remove('preguntas', i)} className={removeBtn}>×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="relative rounded-lg border border-purple-100 bg-white p-6 shadow-sm">
      <LoadingOverlay step={overlayStep} />
      <h2 className="mb-4 text-xl font-semibold text-purple-900">Nueva minuta</h2>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Título de la reunión
          <input type="text" className={`${field} mt-1`} value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sprint Planning" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Fecha
          <input type="date" className={`${field} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
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
            <label className={`cursor-pointer hover:underline ${busy ? 'opacity-50' : ''}`}>
              {busy ? 'Transcribiendo audio…' : 'Subir audio (.mp3/.wav/.m4a/.webm)'}
              <input type="file" accept=".mp3,.wav,.m4a,.webm,audio/*" onChange={handleAudio} className="hidden" disabled={busy} />
            </label>
          </div>
        </div>
        <textarea rows={8} className={`${field} font-mono text-sm`} value={transcript}
          onChange={(e) => setTranscript(e.target.value)} placeholder="Pega aquí la transcripción o súbela…" />
      </div>

      {error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={busy}
          className="rounded-md bg-purple-600 px-6 py-2 font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50">
          {busy ? (overlayStep || 'Generando…') : 'Generar apuntes'}
        </button>
      </div>
    </form>
  );
}
