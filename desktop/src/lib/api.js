// Mismo contrato que frontend/src/lib/api.js. VITE_API_URL se incrusta en el build.
const API_BASE = import.meta.env.VITE_API_URL || 'https://minuta-backend-9ki2.onrender.com';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status} en la API`);
  }
  return data;
}

const json = (body, method = 'POST') => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const analyzeTranscript = (transcript, attendees = [], fechaReunion = null) =>
  request('/api/analyze', json({ transcript, attendees, fecha_reunion: fechaReunion }));

// Clave de Groq guardada en la app (localStorage). Solo se envía si ya pasó la validación.
const KEY_STORAGE = 'minuta.groqKey';
export const getGroqKey = () => localStorage.getItem(KEY_STORAGE) || '';
export const saveGroqKey = (key) => localStorage.setItem(KEY_STORAGE, key);
export const clearGroqKey = () => localStorage.removeItem(KEY_STORAGE);

export const validateGroqKey = (key) => request('/api/groq/validate', json({ key }));

export const transcribeAudio = (file) => {
  const formData = new FormData();
  formData.append('audio', file);
  const key = getGroqKey();
  const headers = key ? { 'X-Groq-Api-Key': key } : {};
  return request('/api/transcribe', { method: 'POST', body: formData, headers });
};

export const createMeeting = (meeting) => request('/api/meetings', json(meeting));

export const getMeetings = () => request('/api/meetings');

export const getMeeting = (id) => request(`/api/meetings/${id}`);

export const updateMeeting = (id, fields) => request(`/api/meetings/${id}`, json(fields, 'PUT'));

// DELETE responde 204 sin cuerpo; request() ya tolera un cuerpo vacío.
export const deleteMeeting = (id) => request(`/api/meetings/${id}`, { method: 'DELETE' });
