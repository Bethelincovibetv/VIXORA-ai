import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Vixora App:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('vixora_projects');
      localStorage.removeItem('vixora_text_chat_history');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-500 border border-orange-500/30 flex items-center justify-center text-2xl mx-auto shadow-lg">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tight">Vixora AI Studio</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                A temporary display issue occurred. Tap below to reload and restore your workspace.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 text-[10px] text-slate-400 font-mono text-left truncate">
                {this.state.error.message}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all"
              >
                Reload Vixora App
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-wider transition-all"
              >
                Clear Cache & Restart Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
