import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    // console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: "sans-serif", backgroundColor: "#ffebee", color: "#c62828", height: "100vh" }}>
          <h1>Something went wrong.</h1>
          <p>The application crashed during render.</p>
          <pre style={{ backgroundColor: "#ffcdd2", padding: 10, borderRadius: 5, overflow: "auto" }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre style={{ backgroundColor: "#ffcdd2", padding: 10, borderRadius: 5, overflow: "auto", fontSize: 12 }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
