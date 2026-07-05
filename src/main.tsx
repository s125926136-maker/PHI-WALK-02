import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safeguard against the benign ResizeObserver loop warning in iframes/web containers
if (typeof window !== 'undefined') {
  const debounce = (callback: (...args: any[]) => void, delay: number) => {
    let timer: any;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  };

  const originalError = window.console.error;
  window.console.error = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && (
      args[0].includes('ResizeObserver loop completed with undelivered notifications') ||
      args[0].includes('ResizeObserver loop limit exceeded')
    )) {
      return;
    }
    originalError.apply(window.console, args);
  };

  window.addEventListener('error', (e) => {
    if (e.message && (
      e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
      e.message.includes('ResizeObserver loop limit exceeded')
    )) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

