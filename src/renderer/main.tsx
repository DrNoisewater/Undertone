import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { PasteCard } from './PasteCard';
import './styles.css';

if (window.location.hash === '#overlay') {
  document.documentElement.classList.add('overlay-route');
  document.body.classList.add('overlay-route');
}
const pasteCard = window.location.hash === '#paste-card';
if (pasteCard) {
  document.documentElement.classList.add('overlay-route');
  document.body.classList.add('overlay-route');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {pasteCard ? <PasteCard /> : <App />}
  </React.StrictMode>,
);
