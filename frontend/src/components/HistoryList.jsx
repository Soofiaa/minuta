export default function HistoryList({ history, onLoad, onDelete }) {
  return (
    <div className="w-72 bg-purple-50/60 p-4 border-r border-purple-100 min-h-screen overflow-y-auto flex-shrink-0 text-left">
      <h3 className="font-semibold text-purple-900 mb-4 text-sm uppercase tracking-wider">Minutas Guardadas</h3>
      {history.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No hay reuniones guardadas.</p>
      ) : (
        <div className="space-y-2">
          {history.map(m => (
            <div key={m.id} className="bg-white p-3 rounded-md shadow-sm border border-purple-100/50 hover:border-purple-300 transition-all">
              <p className="font-medium text-sm text-purple-900 truncate">{m.title}</p>
              <p className="text-xs text-gray-500 mb-2">{m.date || 'Sin fecha'}</p>
              <div className="flex justify-end gap-3 text-xs pt-2 border-t border-gray-100">
                <button onClick={() => onLoad(m.id)} className="text-purple-600 font-medium hover:underline">
                  Cargar
                </button>
                <button onClick={() => onDelete(m.id)} className="text-red-500 font-medium hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
