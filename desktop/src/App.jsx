import { useState, useEffect, useRef } from 'react';
import ApuntesView from './components/ApuntesView';
import HistorialView from './components/HistorialView';
import { transcribeAudio, analyzeTranscript } from './lib/api';

function FloatingWindow() {
  const [time, setTime] = useState(0);
  const [status, setStatus] = useState('recording'); // 'recording', 'paused'
  
  useEffect(() => {
    let timer;
    if (status === 'recording') {
      timer = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    window.electronAPI.onRecordingStatus(setStatus);
  }, []);

  const mins = Math.floor(time / 60);
  const secs = time % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={`p-3 rounded-lg flex items-center justify-between font-bold shadow-xl border [-webkit-app-region:drag] ${status === 'recording' ? 'bg-red-600 text-white border-red-800' : 'bg-amber-500 text-white border-amber-700'}`}>
      <div className="flex items-center">
        <span className="animate-pulse mr-2">{status === 'recording' ? '●' : '⏸'}</span>
        {status === 'recording' ? 'GRABANDO' : 'PAUSA'} {timeStr}
      </div>
      <div className="flex gap-1 [-webkit-app-region:no-drag]">
        <button onClick={() => window.electronAPI.sendControlAction(status === 'recording' ? 'pause' : 'resume')} className="bg-black/20 hover:bg-black/40 px-2 py-1 rounded text-xs">
          {status === 'recording' ? 'Pausar' : 'Reanudar'}
        </button>
        <button onClick={() => window.electronAPI.sendControlAction('stop')} className="bg-red-800 hover:bg-red-900 px-2 py-1 rounded text-xs">
          Detener
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [consented, setConsented] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle', 'recording', 'paused'
  const [mode, setMode] = useState('grabar'); // 'grabar' | 'apuntes' | 'historial'
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  const [activeRecording, setActiveRecording] = useState(null); // Para mostrar en el modo apuntes

  useEffect(() => {
    window.electronAPI.getSources().then(setSources);
    window.electronAPI.getRecordings().then(setRecordings);
    window.electronAPI.onControlAction((action) => {
      if (action === 'pause') pauseRecording();
      else if (action === 'resume') resumeRecording();
      else if (action === 'stop') stopRecording();
    });
  }, []);

  const updateStatus = (newStatus) => {
    setStatus(newStatus);
    window.electronAPI.sendRecordingStatus(newStatus);
  };

  const startRecording = async () => {
    if (!selectedSource || !consented) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource.id } },
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource.id } }
    });
    
    mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.current.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      chunks.current = [];
      const buffer = await blob.arrayBuffer();
      const metadata = { title: selectedSource.name, windowName: selectedSource.name, consentedAt: new Date().toISOString() };
      const recording = await window.electronAPI.saveRecording({ arrayBuffer: buffer, metadata });
      setRecordings(prev => [recording, ...prev]);
      window.electronAPI.stopFloating();
      updateStatus('idle');
      stream.getTracks().forEach(t => t.stop());
    };
    
    mediaRecorder.current.start();
    updateStatus('recording');
    window.electronAPI.startFloating();
  };

  const pauseRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.pause();
      updateStatus('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'paused') {
      mediaRecorder.current.resume();
      updateStatus('recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && (mediaRecorder.current.state === 'recording' || mediaRecorder.current.state === 'paused')) {
      mediaRecorder.current.stop();
    }
  };

  const generateNotes = async (recording) => {
    setActiveRecording(recording);
    setMode('apuntes'); // Cambiar al modo apuntes
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-900 mb-4">Minuta Desktop</h1>

      <nav className="flex gap-1 border-b border-purple-200 mb-6" role="tablist">
        {[['grabar', 'Grabar'], ['apuntes', 'Apuntes'], ['historial', 'Historial']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={`px-5 py-2 font-medium -mb-px border-b-2 ${mode === id ? 'border-purple-600 text-purple-900' : 'border-transparent text-gray-500 hover:text-purple-700'}`}>
            {label}
          </button>
        ))}
      </nav>

      {/* Grabar se oculta, no se desmonta: así la grabación en curso sigue viva al cambiar de pestaña. */}
      <div hidden={mode !== 'grabar'}>
      <div className="bg-white p-6 rounded-xl shadow-md border border-purple-100 mb-6">
        <h2 className="text-xl font-semibold text-purple-800 mb-4">Nueva Grabación</h2>
        <select onChange={(e) => setSelectedSource(sources.find(s => s.id === e.target.value))} className="w-full p-2 border rounded mb-4">
          <option value="">Selecciona una ventana o pantalla</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        
        <label className="flex items-center mb-4 text-sm text-slate-700">
          <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mr-2" />
          Avisé a todas las personas de la reunión que voy a grabar.
        </label>
        
        {status === 'idle' ? (
          <button onClick={startRecording} disabled={!selectedSource || !consented} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50">
            Iniciar Grabación
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={status === 'recording' ? pauseRecording : resumeRecording} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold">
              {status === 'recording' ? 'Pausar' : 'Reanudar'}
            </button>
            <button onClick={stopRecording} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">
              Detener
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-purple-100">
        <h2 className="text-xl font-semibold text-purple-800 mb-4">Grabaciones Anteriores</h2>
        {recordings.map(r => (
          <div key={r.id} className="flex justify-between items-center p-3 border-b border-purple-50">
            <span>{r.title} - {new Date(r.createdAt).toLocaleString()}</span>
            <button onClick={() => generateNotes(r)} className="text-purple-600 font-medium">Generar apuntes</button>
          </div>
        ))}
      </div>
      </div>

      <div hidden={mode !== 'apuntes'}>
        <ApuntesView recording={activeRecording} onClear={() => setActiveRecording(null)} />
      </div>

      {/* Historial se monta al entrar en la pestaña para cargar las minutas solo entonces. */}
      {mode === 'historial' && <HistorialView />}
    </div>
  );
}

export default function App({ route }) {
  const currentRoute = route || window.location.hash;
  if (currentRoute === '#/floating' || currentRoute === '#floating') {
    return <FloatingWindow />;
  }
  return <MainApp />;
}
