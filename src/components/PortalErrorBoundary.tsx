import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PortalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PortalErrorBoundary] Intercepted runtime error in [${this.props.sectionName || "Section"}]:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.warn("Error during boundary reset handler:", err);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      const name = this.props.sectionName || "Department Module";
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xs font-sans animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                Resilient Fault Isolation
              </span>
              <h3 className="text-base font-bold text-white tracking-wide pt-1">
                {name} Encountered a Temporary View Issue
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The rest of the application and your login session remain 100% active and secure. You can safely reset this section without losing your work.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-left">
                <p className="text-[11px] font-mono text-amber-300/90 truncate">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Recover This Section</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    window.location.hash = "";
                    window.location.reload();
                  } catch {}
                }}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 active:scale-95 cursor-pointer"
                title="Reload full page"
              >
                Full Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PortalErrorBoundary;
