import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Se monta como hijo directo de <body> para que el CSS de impresión pueda ocultar
// (display: none) el resto de la app: así el PDF lleva solo los apuntes y no hereda
// el alto de la vista de abajo (que antes agregaba páginas en blanco).
// autoPrint: abre el diálogo de impresión al montar y cierra la vista al terminar
// (lo usa "Exportar PDF").
export default function PrintPreview({ title, date, attendees, notes, onClose, autoPrint = false }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  const dateLabel = m ? `${m[3]}/${m[2]}/${m[1]}` : date || 'No especificada';

  // onClose llega como función nueva en cada render; se guarda en un ref para que el
  // efecto corra una sola vez y no vuelva a abrir el diálogo.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!autoPrint) return undefined;
    const close = () => onCloseRef.current();
    window.addEventListener('afterprint', close, { once: true });
    const id = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', close);
    };
  }, [autoPrint]);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white p-8 overflow-auto print-preview-modal">
      <div className="flex justify-end gap-3 mb-6 print:hidden">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300">
          Cerrar
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 text-gray-900 print:p-0">
        <h1 className="text-3xl font-bold mb-2 text-purple-900">{title}</h1>
        <p className="text-sm text-gray-600 mb-1"><strong>Fecha:</strong> {dateLabel}</p>
        {attendees?.length > 0 && (
          <p className="text-sm text-gray-600 mb-6"><strong>Participantes:</strong> {attendees.join(', ')}</p>
        )}
        <hr className="my-4 border-gray-200" />

        {notes.resumen?.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Resumen</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {notes.resumen.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {notes.temas?.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Temas tratados</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {notes.temas.map((t, i) => (
                <li key={i}><strong>{t.tema}</strong> ({t.menciones} menciones)</li>
              ))}
            </ul>
          </div>
        )}

        {notes.decisiones?.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Decisiones</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {notes.decisiones.map((d, i) => (
                <li key={i}>{d.texto} {d.hablante ? `— ${d.hablante}` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {notes.pendientes?.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Pendientes</h3>
            <ul className="space-y-1 text-sm">
              {notes.pendientes.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span>[{p.hecho ? 'X' : ' '}]</span>
                  <span>{p.texto} {p.responsable ? `— Responsable: ${p.responsable}` : ''} {p.fecha ? `— Fecha: ${p.fecha}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes.preguntas?.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-purple-900 mb-2 text-sm uppercase tracking-wider">Preguntas abiertas</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {notes.preguntas.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
