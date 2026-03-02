import { Note } from 'tonal';
import type { AnalysisResult, BeatGroup, CompositionResult } from '@riffmaster/shared';
import { computeChordVoicings } from './voicing.js';

const STRING_OPEN_MIDI: Record<number, number> = {
  0: 64,
  1: 59,
  2: 55,
  3: 50,
  4: 45,
  5: 40,
};

function pitchClassAt(stringIndex: number, fret: number, capo: number): string {
  return Note.get(Note.fromMidi(STRING_OPEN_MIDI[stringIndex] + capo + fret)).pc;
}

export interface ValidationResult {
  result: CompositionResult;
  corrections: number;
  warnings: string[];
}

export function validateAndCorrect(
  composition: CompositionResult,
  analysis: AnalysisResult,
): ValidationResult {
  const voicings = computeChordVoicings(analysis);
  const warnings: string[] = [];
  let corrections = 0;

  // Build chord timeline: for each beat group determine active chord tones
  const chordTimeline: string[][] = [];
  let beatCursor = 0;
  let chordIdx = 0;
  let chordBeatUsed = 0;

  for (const group of composition.beats) {
    // Advance chord index if current chord's beats are exhausted
    while (chordIdx < voicings.length - 1 && chordBeatUsed >= voicings[chordIdx].beats) {
      chordIdx++;
      chordBeatUsed = 0;
    }
    chordTimeline.push(voicings[chordIdx].tones);
    chordBeatUsed += group.durationBeats;
    beatCursor += group.durationBeats;
  }

  const correctedBeats: BeatGroup[] = composition.beats.map((group, i) => {
    const activeTones = chordTimeline[i];
    const capo = analysis.capoPosition;

    // 1. Correct notes that aren't chord tones
    let correctedNotes = group.notes.map((note) => {
      const pc = pitchClassAt(note.stringIndex, note.fret, capo);
      if (activeTones.includes(pc)) return note;

      // Search outward from current fret on the same string
      for (let offset = 1; offset <= 4; offset++) {
        for (const delta of [offset, -offset]) {
          const newFret = note.fret + delta;
          if (newFret < 0 || newFret > 4) continue;
          const newPc = pitchClassAt(note.stringIndex, newFret, capo);
          if (activeTones.includes(newPc)) {
            corrections++;
            return { ...note, fret: newFret };
          }
        }
      }

      // No correction found on this string — drop the note
      corrections++;
      return null;
    });

    // Filter out dropped notes; ensure at least one note remains
    const validNotes = correctedNotes.filter((n): n is NonNullable<typeof n> => n !== null);
    const finalNotes = validNotes.length > 0 ? validNotes : group.notes.slice(0, 1);

    // 2. Check stretch within the beat (max fret spread)
    const frets = finalNotes.map((n) => n.fret);
    const stretch = Math.max(...frets) - Math.min(...frets);
    if (stretch > 4) {
      // Keep notes closest to the median fret
      const sorted = [...frets].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const clamped = finalNotes.filter((n) => Math.abs(n.fret - median) <= 2);
      if (clamped.length > 0) {
        corrections++;
        warnings.push(`Beat ${i}: stretch ${stretch} reduced`);
        return { ...group, notes: clamped };
      }
    }

    return { ...group, notes: finalNotes };
  });

  // 3. Check position jumps between consecutive beat groups
  for (let i = 1; i < correctedBeats.length; i++) {
    const prevAvg =
      correctedBeats[i - 1].notes.reduce((s, n) => s + n.fret, 0) /
      correctedBeats[i - 1].notes.length;
    const currAvg =
      correctedBeats[i].notes.reduce((s, n) => s + n.fret, 0) / correctedBeats[i].notes.length;
    if (Math.abs(currAvg - prevAvg) > 5) {
      warnings.push(`Beat ${i}: position jump of ${Math.abs(currAvg - prevAvg).toFixed(1)} frets`);
    }
  }

  console.log(`[validation] corrections: ${corrections}, warnings: ${warnings.length}`);
  if (warnings.length) console.log('[validation] warnings:', warnings);

  return {
    result: { ...composition, beats: correctedBeats },
    corrections,
    warnings,
  };
}
