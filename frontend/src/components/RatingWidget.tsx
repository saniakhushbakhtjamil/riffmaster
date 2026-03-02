import { useState } from 'react';
import { submitRating } from '../api/client';
import type { RatingRequest } from '@riffmaster/shared';

interface RatingWidgetProps {
  songTitle: string;
  artistName: string;
}

export function RatingWidget({ songTitle, artistName }: RatingWidgetProps) {
  const [playability, setPlayability] = useState(0);
  const [musicality, setMusicality] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (playability === 0 || musicality === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: RatingRequest = { songTitle, artistName, playability, musicality };
      if (comment.trim()) payload.comment = comment.trim();
      await submitRating(payload);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-4 text-sm text-emerald-400">
        Thanks for the feedback — it helps improve the tab quality.
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Rate this tab
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
        <StarRating label="Playability" value={playability} onChange={setPlayability} />
        <StarRating label="Musicality" value={musicality} onChange={setMusicality} />
      </div>
      <textarea
        className="mt-3 w-full rounded-md bg-slate-800 px-3 py-2 text-xs text-slate-300 placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-600"
        rows={2}
        placeholder="Optional comment…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={playability === 0 || musicality === 0 || submitting}
        className="mt-2 rounded-md bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Submitting…' : 'Submit rating'}
      </button>
    </div>
  );
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`text-lg leading-none transition ${
              star <= value ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'
            }`}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
