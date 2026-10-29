import './polyfill.ts';
import React, {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends React.Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // console.error("Caught by RootErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", fontFamily: "sans-serif", backgroundColor: "#0f172a", color: "#f8fafc", height: "100vh", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ maxWidth: "600px", width: "100%", backgroundColor: "#1e293b", padding: "30px", borderRadius: "16px", border: "1px solid #334155", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h1 style={{ color: "#f97316", fontSize: "22px", margin: "0 0 10px 0", fontWeight: "800" }}>Application Notice</h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              The application encountered a temporary display or state synchronization error. Click the button below to reload cleanly.
            </p>
            <button
              onClick={() => {
                try {
                  sessionStorage.clear();
                } catch(e) {}
                window.location.href = window.location.origin + window.location.pathname;
              }}
              style={{
                backgroundColor: "#ea580c",
                color: "#ffffff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(234, 88, 12, 0.4)",
                transition: "all 0.2s"
              }}
            >
              🔄 Reload Application Now
            </button>
            <details style={{ marginTop: "24px", textAlign: "left", cursor: "pointer" }}>
              <summary style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>Technical Details</summary>
              <pre style={{ backgroundColor: "#0f172a", padding: "12px", borderRadius: "8px", whiteSpace: "pre-wrap", textAlign: "left", fontSize: "11px", color: "#f87171", marginTop: "10px", overflowX: "auto" }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </StrictMode>,
    );
  }
} catch (e: any) {
  console.error("Critical mounting error:", e);
  const container = document.getElementById('root');
  if (container) {
    container.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; background: #0f172a; color: #fff; min-height: 100vh; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h2 style="color: #ea580c; font-size: 20px;">Starting Application...</h2>
        <p style="color: #94a3b8; font-size: 13px; margin: 10px 0 20px;">Please click to reload cleanly if loading does not proceed.</p>
        <button onclick="sessionStorage.clear(); location.reload();" style="background: #ea580c; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer;">
          🔄 Reload Application
        </button>
      </div>
    `;
  }
}
