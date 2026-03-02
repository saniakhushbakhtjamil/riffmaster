import { Chord, Note, Scale } from 'tonal';
import type { AnalysisResult } from '@riffmaster/shared';

// MIDI note for each open string in standard tuning (stringIndex 0 = high e)
const STRING_OPEN_MIDI: Record<number, number> = {
  0: 64, // high e (E4)
  1: 59, // B  (B3)
  2: 55, // G  (G3)
  3: 50, // D  (D3)
  4: 45, // A  (A2)
  5: 40, // low E (E2)
};

const STRING_NAMES: Record<number, string> = {
  0: 'high e',
  1: 'B',
  2: 'G',
  3: 'D',
  4: 'A',
  5: 'low E',
};

export interface NotePosition {
  stringIndex: number;
  fret: number;
  note: string; // pitch class, e.g. 'E'
}

export interface ChordVoicingInfo {
  chord: string;
  beats: number;
  tones: string[];           // pitch classes, e.g. ['E', 'G', 'B', 'D']
  positions: NotePosition[]; // valid (stringIndex, fret) pairs, frets 0–4 relative to capo
}

export interface ScaleInfo {
  scaleName: string;
  tones: string[];           // pitch classes in the scale
  positions: NotePosition[]; // all positions across frets 0–12
}

function getChordTones(chord: string): string[] {
  const data = Chord.get(chord);
  if (data.notes.length > 0) return data.notes;

  for (const alias of [chord + 'M', chord.replace(/sus\d+/, ''), chord.replace(/add\d+/, '')]) {
    const fallback = Chord.get(alias);
    if (fallback.notes.length > 0) return fallback.notes;
  }

  return [];
}

function getScaleTones(key: string): { scaleName: string; tones: string[] } {
  // Try pentatonic first (best for riffs/licks), fall back to full scale
  const candidates = [
    `${key} pentatonic`,
    `${key} minor pentatonic`,
    `${key} major pentatonic`,
    key,
    `${key} major`,
    `${key} minor`,
  ];

  for (const name of candidates) {
    const scale = Scale.get(name);
    if (scale.notes.length > 0) {
      return { scaleName: scale.name, tones: scale.notes };
    }
  }

  return { scaleName: key, tones: [] };
}

export function computeChordVoicings(analysis: AnalysisResult): ChordVoicingInfo[] {
  return analysis.chordProgression.map(({ chord, beats }) => {
    const tones = getChordTones(chord);

    const positions: NotePosition[] = [];
    for (let s = 0; s <= 5; s++) {
      const openMidi = STRING_OPEN_MIDI[s] + analysis.capoPosition;
      for (let fret = 0; fret <= 4; fret++) {
        const pc = Note.get(Note.fromMidi(openMidi + fret)).pc;
        if (tones.includes(pc)) {
          positions.push({ stringIndex: s, fret, note: pc });
        }
      }
    }

    return { chord, beats, tones, positions };
  });
}

export function computeScalePositions(analysis: AnalysisResult): ScaleInfo {
  const { scaleName, tones } = getScaleTones(analysis.key);

  const positions: NotePosition[] = [];
  for (let s = 0; s <= 5; s++) {
    const openMidi = STRING_OPEN_MIDI[s] + analysis.capoPosition;
    for (let fret = 0; fret <= 12; fret++) {
      const pc = Note.get(Note.fromMidi(openMidi + fret)).pc;
      if (tones.includes(pc)) {
        positions.push({ stringIndex: s, fret, note: pc });
      }
    }
  }

  return { scaleName, tones, positions };
}

export function formatVoicingsForPrompt(voicings: ChordVoicingInfo[]): string {
  return voicings
    .map(({ chord, beats, tones, positions }) => {
      const byString: Record<number, NotePosition[]> = {};
      for (const pos of positions) {
        (byString[pos.stringIndex] ??= []).push(pos);
      }

      const stringLines = [5, 4, 3, 2, 1, 0]
        .filter((s) => byString[s]?.length)
        .map((s) => {
          const options = byString[s].map((p) => `fret ${p.fret} → ${p.note}`).join(', ');
          return `  String ${s} (${STRING_NAMES[s]}): ${options}`;
        });

      return [
        `${chord} [${beats} beat${beats !== 1 ? 's' : ''}] — tones: ${tones.join(' ')}`,
        ...stringLines,
      ].join('\n');
    })
    .join('\n\n');
}

export function formatScaleForPrompt(scale: ScaleInfo): string {
  const byString: Record<number, NotePosition[]> = {};
  for (const pos of scale.positions) {
    (byString[pos.stringIndex] ??= []).push(pos);
  }

  const stringLines = [5, 4, 3, 2, 1, 0]
    .filter((s) => byString[s]?.length)
    .map((s) => {
      const options = byString[s].map((p) => `fret ${p.fret}`).join(', ');
      return `  String ${s} (${STRING_NAMES[s]}): ${options}`;
    });

  return [`${scale.scaleName} — tones: ${scale.tones.join(' ')}`, ...stringLines].join('\n');
}
