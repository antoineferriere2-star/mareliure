// Purely presentational: renders an already-localized fallback message.
// Never decides which message applies (see decideDeckPreviewSection in
// deckPreviewDisplay.ts) and never invents a geometric preview.
export function DeckPreviewFallback({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      {message}
    </div>
  );
}
