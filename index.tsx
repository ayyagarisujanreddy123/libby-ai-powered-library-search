import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

import('./App')
  .then((module) => {
    const App = module.default;
    root.render(
      React.createElement(React.StrictMode, null, React.createElement(App))
    );
  })
  .catch((error) => {
    rootElement.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:24px;">
        <div style="background:#1f2937;border:1px solid #374151;border-radius:16px;padding:32px;max-width:480px;text-align:center;">
          <h1 style="color:white;font-family:system-ui;margin:0 0 8px;">Failed to Load</h1>
          <p style="color:#9ca3af;font-family:system-ui;font-size:14px;margin:0 0 16px;">
            ${error instanceof Error ? error.message : String(error)}
          </p>
          <button onclick="location.reload()" style="background:#3b82f6;color:white;border:none;padding:10px 24px;border-radius:10px;font-family:system-ui;font-size:14px;cursor:pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  });
