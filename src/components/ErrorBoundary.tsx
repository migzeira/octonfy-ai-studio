import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center p-8 rounded-xl border border-border bg-card max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Algo deu errado nesta seção
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "Ocorreu um erro inesperado."}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-all"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.href = "/dashboard"}
                className="px-4 py-2 rounded-lg gradient-cta text-white font-medium text-sm hover:brightness-110 transition-all"
              >
                Ir ao Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
