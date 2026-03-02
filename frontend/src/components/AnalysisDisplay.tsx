import type { AnalysisResult } from '@riffmaster/shared';

interface AnalysisDisplayProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
}

export function AnalysisDisplay({ analysis, isLoading }: AnalysisDisplayProps) {
  return (
    <section className="mt-6 w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Song Analysis
      </h2>

      {isLoading && <p className="text-sm text-slate-300">Analysing song...</p>}

      {!isLoading && !analysis && (
        <p className="text-sm text-slate-400">Analysis will appear here.</p>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Key</p>
              <p className="mt-1 text-base font-semibold text-emerald-400">{analysis.key}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tempo</p>
              <p className="mt-1 text-base font-semibold text-emerald-400">{analysis.tempo} BPM</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Capo</p>
              <p className="mt-1 text-base font-semibold text-emerald-400">
                {analysis.capoPosition === 0 ? 'No capo' : `Fret ${analysis.capoPosition}`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Chord Progression
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.chordProgression.map((item, i) => (
                <span
                  key={i}
                  className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-sm font-medium text-emerald-300"
                >
                  {item.chord}
                  <span className="ml-1 text-xs text-emerald-600">{item.beats}b</span>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Strumming Pattern
            </p>
            <p className="mt-1 font-mono text-sm text-slate-200">{analysis.strummingPattern}</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              How to Play
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{analysis.playingGuide}</p>
          </div>
        </div>
      )}
    </section>
  );
}
