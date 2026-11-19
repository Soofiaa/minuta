// Utilidades compartidas de la app de escritorio.

// "2026-11-18" -> "18/11/2026". Si no tiene ese formato, se muestra tal cual.
export const formatDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value || 'No especificada';
};

// Fecha local a medianoche desde "YYYY-MM-DD"; null si no tiene ese formato.
const parseDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

// Busca en título, fecha (dd/mm/aaaa) y participantes. Sin texto, todo coincide.
export const matchesQuery = (meeting, query) => {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const fields = [meeting.title, meeting.date ? formatDate(meeting.date) : '', ...(meeting.attendees || [])];
  return fields.some((f) => String(f).toLowerCase().includes(term));
};

// range: "todas" | "semana" (lunes a domingo) | "mes", según la fecha de la minuta.
export const inRange = (value, range) => {
  if (range === 'todas') return true;
  const d = parseDate(value);
  if (!d) return false;
  const now = new Date();
  if (range === 'mes') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return d >= monday && d <= sunday;
};

// Rechaza si la promesa no resuelve en 120 s; limpia el temporizador al terminar.
export const withTimeout = (promise, what) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout en ${what}`)), 120000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const downloadText = (filename, content, type = 'text/markdown') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
