// Overlay de pantalla completa con spinner. Bloquea la app mientras hay un paso en curso.
export default function LoadingOverlay({ step }) {
  if (!step) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-8 shadow-xl">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
        <p className="font-semibold text-purple-900">Generando apuntes</p>
        <p className="text-sm text-gray-500">{step}</p>
      </div>
    </div>
  );
}
