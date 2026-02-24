import { useState } from 'react';

import type { GenerateTabRequest } from '@riffmaster/shared';

interface ChordFormProps {
  onSubmit: (payload: GenerateTabRequest) => Promise<void>;
  isLoading: boolean;
}

export function ChordForm({ onSubmit, isLoading }: ChordFormProps) {
  const [songTitle, setSongTitle] = useState('Wonderwall');
  const [artistName, setArtistName] = useState('Oasis');
  const [tempo, setTempo] = useState(90);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!songTitle.trim() || !artistName.trim()) {
      setError('Please enter both song title and artist.');
      return;
    }

    if (tempo < 40 || tempo > 220) {
      setError('Tempo should be between 40 and 220 BPM.');
      return;
    }

    const payload: GenerateTabRequest = {
      songTitle: songTitle.trim(),
      artistName: artistName.trim(),
      tempo
    };

    await onSubmit(payload);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg"
    >
      <h1 className="text-xl font-semibold text-slate-50">AI Guitar Composer</h1>
      <p className="text-sm text-slate-400">
        Enter a song and artist and we&apos;ll mock up a beginner-friendly guitar tab.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Song title
          </label>
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Song name"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Artist
          </label>
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Artist name"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Tempo (BPM)
          </label>
          <input
            type="number"
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="w-32 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            min={40}
            max={220}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-md transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800"
        >
          {isLoading ? 'Generating...' : 'Generate Tab'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}

