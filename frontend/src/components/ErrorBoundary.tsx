import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, render the error text (used at the app root for diagnostics). */
  showError?: boolean;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface in console for debugging.
    console.error("Plexa ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      if (this.props.showError) {
        return (
          <div style={{ padding: 32, maxWidth: 760, margin: "40px auto", fontFamily: "Inter, sans-serif" }}>
            <h2 style={{ marginBottom: 8 }}>Something went wrong rendering the app</h2>
            <p style={{ color: "var(--text-dim)" }}>
              The error below was caught so the page didn't go blank. Share it if it persists.
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "rgba(248, 113, 113, 0.06)",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                borderRadius: 10,
                padding: 16,
                fontSize: 13,
              }}
            >
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ marginTop: 12, padding: "10px 16px", borderRadius: 9, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        );
      }
      return null;
    }
    return this.props.children;
  }
}
