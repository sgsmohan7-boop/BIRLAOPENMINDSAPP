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
        <div style={{ padding: "40px", fontFamily: "sans-serif", backgroundColor: "#333", color: "#fff", height: "100vh", overflow: "auto" }}>
          <h1 style={{ color: "#ff8080" }}>🚨 Application Crashed</h1>
          <h3 style={{ marginTop: "20px" }}>Error Message:</h3>
          <pre style={{ backgroundColor: "#111", padding: "15px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <h3 style={{ marginTop: "20px" }}>Component Stack Trace:</h3>
          <pre style={{ backgroundColor: "#111", padding: "15px", borderRadius: "8px", fontSize: "13px", whiteSpace: "pre-wrap" }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
