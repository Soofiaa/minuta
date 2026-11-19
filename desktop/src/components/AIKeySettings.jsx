import { useState } from 'react';
import { getGroqKey, saveGroqKey, clearGroqKey, validateGroqKey } from '../lib/api';

const btn = 'text-sm px-4 py-1.5 rounded-md font-medium disabled:opacity-50';
const primary = `${btn} bg-purple-600 text-white hover:bg-purple-700`;
const secondary = `${btn} bg-purple-100 text-purple-800 hover:bg-purple-200`;

// Clave de IA del usuario (Groq). Se guarda en la app, no en el repo ni en el backend.
export default function AIKeySettings() {
  const [saved, setSaved] = useState(getGroqKey());
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState(null); // { ok, text }
  const [checking, setChecking] = useState(false);

  const test = async () => {
    setStatus(null);
    setChecking(true);
    try {
      const { valid } = await validateGroqKey(draft.trim());
      if (valid) {
        saveGroqKey(draft.trim());
        setSaved(draft.trim());
        setDraft('');
        setStatus({ ok: true, text: 'Clave válida, puedes usarla. Quedó guardada.' });
      } else {
        setStatus({ ok: false, text: 'Clave inválida, revisa tu clave en Configuración.' });
      }
    } catch (err) {
      // Error de red o de Groq: no guardamos nada.
      setStatus({ ok: false, text: `No se pudo validar la clave: ${err.message}` });
    } finally {
      setChecking(false);
    }
  };

  const remove = () => {
    clearGroqKey();
    setSaved('');
    setDraft('');
    setStatus({ ok: true, text: 'Clave borrada. Se usará la clave del servidor, si existe.' });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100 max-w-2xl">
      <h2 className="text-xl font-semibold text-purple-900 mb-1">Clave de IA</h2>
      <p className="text-sm text-gray-600 mb-4">
        Tu clave de Groq sirve para transcribir audios. Se guarda solo en esta app.
      </p>

      <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
        <p className="font-semibold mb-1">Cómo conseguir una clave gratis</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Entra a <a className="text-purple-700 underline" href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a> y crea una cuenta.</li>
          <li>Ve a <strong>API Keys</strong> y crea una clave nueva.</li>
          <li>Cópiala y pégala aquí abajo.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          Groq tiene plan gratuito con límites de uso. Como alternativa, OpenRouter ofrece modelos gratuitos con clave.
        </p>
      </div>

      <div className="mb-2 text-sm">
        Clave actual: <span className="font-mono">{saved ? '••••••••' : 'ninguna'}</span>
      </div>

      <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)}
        placeholder="Pega tu clave de Groq (gsk_…)" autoComplete="off"
        className="w-full rounded-md border border-purple-200 p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={test} disabled={!draft.trim() || checking} className={primary}>
          {checking ? 'Probando…' : 'Probar y guardar'}
        </button>
        <button onClick={remove} disabled={!saved} className={secondary}>Borrar</button>
      </div>

      {status && (
        <p className={`mt-3 rounded-md border p-3 text-sm ${status.ok ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-700'}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
