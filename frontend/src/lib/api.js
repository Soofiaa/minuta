const API_BASE = import.meta.env.VITE_API_URL || '';

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

export const getHealth = () => request('/api/health');
export const analyzeTranscript = (transcript, attendees = [], fechaReunion = null) =>
  request('/api/analyze', json({ transcript, attendees, fecha_reunion: fechaReunion }));

export const transcribeAudio = (file) => {
  const formData = new FormData();
  formData.append('audio', file);
  return request('/api/transcribe', { method: 'POST', body: formData });
};

export const listMeetings = () => request('/api/meetings');
export const getMeeting = (id) => request(`/api/meetings/${id}`);
export const createMeeting = (meeting) => request('/api/meetings', json(meeting));
export const updateMeeting = (id, meeting) => request(`/api/meetings/${id}`, json(meeting, 'PUT'));
export const deleteMeeting = (id) => request(`/api/meetings/${id}`, { method: 'DELETE' });
