import type { TabModel } from '@riffmaster/shared';

interface TabDisplayProps {
  ascii: string | null;
  model: TabModel | null;
  isLoading: boolean;
  error: string | null;
}

export function TabDisplay({ ascii, model, isLoading, error }: TabDisplayProps) {
  return (
    <section className="mt-6 w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Generated Tab
      </h2>
      {isLoading && <p className="text-sm text-slate-300">Generating tab...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!isLoading && !error && !ascii && (
        <p className="text-sm text-slate-400">Your tab will appear here.</p>
      )}
      {ascii && (
        <pre className="mt-2 overflow-auto rounded-md bg-black/60 p-3 text-xs leading-6 text-emerald-300">
          {ascii}
        </pre>
      )}
      {model && (
        <p className="mt-3 text-xs text-slate-400">
          Tuning: {model.tuning.join(' ')} • Tempo: {model.tempo} bpm
        </p>
      )}
    </section>
  );
}

