import React from 'react';
import ReactDOM from 'react-dom/client';

// Safari compatibility check
if (typeof window !== 'undefined' && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
  console.log('Safari detected - applying compatibility fixes...');
}

console.log('index.tsx: Starting app initialization...');
console.log('index.tsx: React imported:', typeof React);
console.log('index.tsx: ReactDOM imported:', typeof ReactDOM);
console.log('index.tsx: Browser:', navigator.userAgent);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('index.tsx: Root element not found!');
  throw new Error("Could not find root element to mount to");
}

console.log('index.tsx: Root element found, creating React root...');

// Test with a simple component first
function TestApp() {
  console.log('TestApp: Component rendering...');
  return React.createElement('div', {
    style: { color: 'white', padding: '20px', fontSize: '24px' }
  }, 'React is working! Loading full app...');
}

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('index.tsx: React root created');
  
  // First render a simple test
  root.render(React.createElement(TestApp));
  console.log('index.tsx: Test component rendered');
  
  // Then load the full app asynchronously (Safari-compatible)
  // Use requestAnimationFrame for better Safari compatibility
  requestAnimationFrame(() => {
    setTimeout(() => {
      import('./App')
        .then((module) => {
          console.log('index.tsx: App component loaded, rendering...');
          const App = module.default;
          root.render(
            React.createElement(React.StrictMode, null,
              React.createElement(App)
            )
          );
          console.log('index.tsx: Full App rendered successfully!');
        })
        .catch((error) => {
          console.error('index.tsx: Error loading App component:', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : '';
          rootElement.innerHTML = `
            <div style="color: white; padding: 20px; font-family: monospace; background: #dc2626; border-radius: 8px; margin: 20px;">
              <h1 style="color: white;">Error Loading App Component</h1>
              <pre style="background: #1f1f1f; padding: 10px; border-radius: 4px; overflow: auto; white-space: pre-wrap;">${errorMsg}</pre>
              <pre style="background: #1f1f1f; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; white-space: pre-wrap;">${errorStack}</pre>
            </div>
          `;
        });
    }, 100);
  });
  
} catch (error) {
  console.error('index.tsx: Error in initialization:', error);
  rootElement.innerHTML = `
    <div style="color: white; padding: 20px; font-family: monospace; background: #dc2626; border-radius: 8px; margin: 20px;">
      <h1 style="color: white;">Error Initializing React</h1>
      <pre style="background: #1f1f1f; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
      <pre style="background: #1f1f1f; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">${error instanceof Error ? error.stack : ''}</pre>
    </div>
  `;
}
