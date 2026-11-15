import React, { useState } from 'react';
import { generateMarkdown } from '../lib/markdown';

export default function NotesView({ title, date, notes, onSave, onBack }) {
  const [localNotes, setLocalNotes] = useState(notes);

  const handleCopyMarkdown = () => {
    const md = generateMarkdown(title, date, localNotes);
    navigator.clipboard.writeText(md);
    alert('Apuntes copiados al portapapeles');
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown(title, date, localNotes);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_minuta.md`;
    a.click();
  };

  const updateSection = (section, newValue) => {
    setLocalNotes({ ...localNotes, [section]: newValue });
  };

  const removeItem = (section, index) => {
    const newItems = [...localNotes[section]];
    newItems.splice(index, 1);
    updateSection(section, newItems);
  };

  return (
    <div className="bg-white p-6 shadow-sm rounded-lg border border-purple-100 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <button onClick={onBack} className="text-sm text-purple-600 hover:underline mb-2 inline-block">
            ← Volver al formulario
          </button>
          <h2 className="text-2xl font-bold text-purple-900">{title}</h2>
          <p className="text-sm text-gray-500">Fecha: {date || 'No especificada'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCopyMarkdown} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium">
            Copiar como Markdown
          </button>
          <button onClick={handleDownloadMarkdown} className="text-sm bg-purple-100 text-purple-800 px-3 py-1.5 rounded-md hover:bg-purple-200 font-medium">
            Descargar .md
          </button>
          <button onClick={() => onSave(localNotes)} className="text-sm bg-purple-600 text-white px-4 py-1.5 rounded-md hover:bg-purple-700 font-medium shadow-sm">
            Guardar Minuta
          </button>
        </div>
      </div>

      {/* Participantes */}
      <div className="mb-6 bg-purple-50/50 p-4 rounded-md border border-purple-100">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Participantes</h3>
        <input
          className="w-full bg-white border border-gray-200 rounded p-2 text-sm"
          value={localNotes.participantes?.join(', ') || ''}
          onChange={(e) => {
            const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            updateSection('participantes', arr);
          }}
          placeholder="Participantes separados por coma"
        />
        {localNotes.total_intervenciones !== undefined && (
          <p className="text-xs text-gray-500 mt-1">Total de intervenciones registradas: {localNotes.total_intervenciones}</p>
        )}
      </div>

      {/* Resumen */}
      <div className="mb-6">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Resumen</h3>
        <div className="space-y-2">
          {localNotes.resumen?.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="flex-grow border border-gray-200 rounded p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                value={r}
                onChange={(e) => {
                  const newRes = [...localNotes.resumen];
                  newRes[i] = e.target.value;
                  updateSection('resumen', newRes);
                }}
              />
              <button onClick={() => removeItem('resumen', i)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Temas Tratados */}
      <div className="mb-6">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Temas Tratados</h3>
        <div className="space-y-3">
          {localNotes.temas?.map((t, i) => (
            <div key={i} className="border border-gray-200 rounded p-3 bg-gray-50/50">
              <div className="flex gap-2 items-center mb-2">
                <input
                  className="flex-grow font-medium border border-gray-200 rounded p-1 text-sm bg-white"
                  value={t.tema}
                  onChange={(e) => {
                    const newTemas = [...localNotes.temas];
                    newTemas[i] = { ...newTemas[i], tema: e.target.value };
                    updateSection('temas', newTemas);
                  }}
                  placeholder="Nombre del tema"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">({t.menciones} menciones)</span>
                <button onClick={() => removeItem('temas', i)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">×</button>
              </div>
              {t.ejemplos && t.ejemplos.length > 0 && (
                <div className="text-xs text-gray-600 pl-2 border-l-2 border-purple-200 space-y-1">
                  {t.ejemplos.map((ej, j) => (
                    <p key={j}>• {ej}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decisiones */}
      <div className="mb-6">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Decisiones</h3>
        <div className="space-y-2">
          {localNotes.decisiones?.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="flex-grow border border-gray-200 rounded p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                value={d.texto}
                onChange={(e) => {
                  const newDec = [...localNotes.decisiones];
                  newDec[i] = { ...newDec[i], texto: e.target.value };
                  updateSection('decisiones', newDec);
                }}
              />
              <input
                className="w-32 border border-gray-200 rounded p-2 text-xs text-gray-600"
                value={d.hablante || ''}
                onChange={(e) => {
                  const newDec = [...localNotes.decisiones];
                  newDec[i] = { ...newDec[i], hablante: e.target.value };
                  updateSection('decisiones', newDec);
                }}
                placeholder="Hablante"
              />
              <button onClick={() => removeItem('decisiones', i)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Pendientes */}
      <div className="mb-6">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Pendientes</h3>
        <div className="space-y-2">
          {localNotes.pendientes?.map((p, i) => (
            <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-100">
              <input
                type="checkbox"
                checked={!!p.hecho}
                onChange={() => {
                  const newP = [...localNotes.pendientes];
                  newP[i] = { ...newP[i], hecho: !newP[i].hecho };
                  updateSection('pendientes', newP);
                }}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                title="Marcar como hecho"
              />
              <input
                className={`flex-grow border border-gray-200 rounded p-1.5 text-sm bg-white ${p.hecho ? 'line-through text-gray-400' : ''}`}
                value={p.texto}
                onChange={(e) => {
                  const newP = [...localNotes.pendientes];
                  newP[i] = { ...newP[i], texto: e.target.value };
                  updateSection('pendientes', newP);
                }}
                placeholder="Descripción de la tarea"
              />
              <input
                className="w-28 border border-gray-200 rounded p-1.5 text-xs bg-white text-gray-600"
                value={p.responsable || ''}
                onChange={(e) => {
                  const newP = [...localNotes.pendientes];
                  newP[i] = { ...newP[i], responsable: e.target.value };
                  updateSection('pendientes', newP);
                }}
                placeholder="Responsable"
              />
              <input
                className="w-24 border border-gray-200 rounded p-1.5 text-xs bg-white text-gray-600"
                value={p.fecha || ''}
                onChange={(e) => {
                  const newP = [...localNotes.pendientes];
                  newP[i] = { ...newP[i], fecha: e.target.value };
                  updateSection('pendientes', newP);
                }}
                placeholder="Fecha"
              />
              <button onClick={() => removeItem('pendientes', i)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Preguntas abiertas */}
      <div className="mb-4">
        <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Preguntas Abiertas</h3>
        <div className="space-y-2">
          {localNotes.preguntas?.map((q, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="flex-grow border border-gray-200 rounded p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                value={q}
                onChange={(e) => {
                  const newQ = [...localNotes.preguntas];
                  newQ[i] = e.target.value;
                  updateSection('preguntas', newQ);
                }}
              />
              <button onClick={() => removeItem('preguntas', i)} className="text-red-500 hover:text-red-700 px-2 py-1 text-lg font-bold">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
