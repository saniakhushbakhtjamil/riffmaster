import type { TabModel } from '@riffmaster/shared';
import { RatingWidget } from './RatingWidget';

interface TabDisplayProps {
  ascii: string | null;
  model: TabModel | null;
  arrangementNotes: string | null;
  isLoading: boolean;
  error: string | null;
  songTitle?: string;
  artistName?: string;
}

export function TabDisplay({ ascii, model, arrangementNotes, isLoading, error, songTitle, artistName }: TabDisplayProps) {
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
      {arrangementNotes && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            How to Play
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{arrangementNotes}</p>
        </div>
      )}
      {ascii && songTitle && artistName && (
        <RatingWidget songTitle={songTitle} artistName={artistName} />
      )}
    </section>
  );
}
