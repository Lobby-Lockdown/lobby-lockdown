import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';

console.log('Renderer script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  const container = document.getElementById('root');
  console.log('Root container:', container);

  if (container) {
    console.log('Creating React root');
    const root = createRoot(container);
    console.log('Rendering React app');
    root.render(<App />);
    console.log('React app rendered');
  } else {
    console.error('Root element not found');
  }
});
