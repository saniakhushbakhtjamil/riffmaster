import type { AnalysisResult, GenerateTabRequest } from '@riffmaster/shared';

const COMMON_PROGRESSIONS: Array<{ key: string; chords: string[] }> = [
  { key: 'C major', chords: ['C', 'G', 'Am', 'F'] },
  { key: 'G major', chords: ['G', 'D', 'Em', 'C'] },
  { key: 'D major', chords: ['D', 'A', 'Bm', 'G'] }
];

export async function runAnalysisStep(req: GenerateTabRequest): Promise<AnalysisResult> {
  const seed =
    Array.from(req.songTitle + req.artistName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    COMMON_PROGRESSIONS.length;

  const progressionTemplate = COMMON_PROGRESSIONS[seed];
  const capoPosition = seed;

  const chordProgression = progressionTemplate.chords.map((chord) => ({
    chord,
    beats: 4
  }));

  return {
    key: progressionTemplate.key,
    capoPosition,
    chordProgression
  };
}

