// A rendering error in the visual preview must never break the rest of the
// Project Summary page — the text summary is the primary result and the
// preview is strictly a secondary enhancement. React error boundaries must
// be class components; this is the one class component in this feature.
// Logs to the visitor's own browser console only (console.error, not the
// server-side operationalLog helper) — this component runs client-side.
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackMessage: string;
}

interface State {
  hasError: boolean;
}

export class DeckPreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[metre-build] visitor-summary.visual-preview-render-failed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          {this.props.fallbackMessage}
        </div>
      );
    }
    return this.props.children;
  }
}
