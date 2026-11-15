import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

// Simple route handler based on hash
const renderApp = () => {
  const hash = window.location.hash;
  root.render(<App route={hash} />);
};

window.addEventListener('hashchange', renderApp);
renderApp();
