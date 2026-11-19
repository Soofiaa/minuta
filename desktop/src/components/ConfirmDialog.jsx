import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Confirmación dentro de la app. Reemplaza window.confirm(): en Electron para Windows,
// después del diálogo nativo los inputs dejan de recibir teclado hasta que la ventana
// pierde y recupera el foco.
export default function ConfirmDialog({ message, confirmLabel = 'Aceptar', danger = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-msg"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p id="confirm-dialog-msg" className="mb-6 text-sm text-gray-800">{message}</p>
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel}
            className="rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
