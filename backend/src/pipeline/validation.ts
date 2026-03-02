import { Note } from 'tonal';
import type { AnalysisResult, BeatGroup, CompositionResult } from '@riffmaster/shared';
import { computeChordVoicings, computeScalePositions } from './voicing.js';

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
  const scale = computeScalePositions(analysis);
  const scaleTones = new Set(scale.tones);
  const warnings: string[] = [];
  let corrections = 0;

  // Build chord timeline: for each beat group determine active chord tones
  const chordTimeline: string[][] = [];
  let chordIdx = 0;
  let chordBeatUsed = 0;

  for (const group of composition.beats) {
    while (chordIdx < voicings.length - 1 && chordBeatUsed >= voicings[chordIdx].beats) {
      chordIdx++;
      chordBeatUsed = 0;
    }
    chordTimeline.push(voicings[chordIdx].tones);
    chordBeatUsed += group.durationBeats;
  }

  const correctedBeats: BeatGroup[] = composition.beats.map((group, i) => {
    const chordTones = chordTimeline[i];
    const capo = analysis.capoPosition;

    // A note is valid if it's a chord tone OR a scale tone
    const correctedNotes = group.notes.map((note) => {
      // Fret must be in valid range
      if (note.fret < 0 || note.fret > 24) {
        corrections++;
        return null;
      }

      const pc = pitchClassAt(note.stringIndex, note.fret, capo);

      // Accept chord tones and scale tones — only reject truly out-of-key notes
      if (chordTones.includes(pc) || scaleTones.has(pc)) return note;

      // Note is outside the scale — find nearest scale tone on same string
      for (let offset = 1; offset <= 3; offset++) {
        for (const delta of [offset, -offset]) {
          const newFret = note.fret + delta;
          if (newFret < 0 || newFret > 12) continue;
          const newPc = pitchClassAt(note.stringIndex, newFret, capo);
          if (scaleTones.has(newPc)) {
            corrections++;
            return { ...note, fret: newFret };
          }
        }
      }

      // Can't correct — drop the note
      corrections++;
      return null;
    });

    const validNotes = correctedNotes.filter((n): n is NonNullable<typeof n> => n !== null);
    const finalNotes = validNotes.length > 0 ? validNotes : group.notes.slice(0, 1);

    // Check stretch within beat (allow up to 5 frets for riffs — wider than chord voicings)
    const frets = finalNotes.map((n) => n.fret);
    const stretch = Math.max(...frets) - Math.min(...frets);
    if (stretch > 5) {
      const sorted = [...frets].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const clamped = finalNotes.filter((n) => Math.abs(n.fret - median) <= 3);
      if (clamped.length > 0) {
        corrections++;
        warnings.push(`Beat ${i}: stretch ${stretch} reduced`);
        return { ...group, notes: clamped };
      }
    }

    return { ...group, notes: finalNotes };
  });

  // Check position jumps between consecutive beat groups
  for (let i = 1; i < correctedBeats.length; i++) {
    const prevAvg =
      correctedBeats[i - 1].notes.reduce((s, n) => s + n.fret, 0) /
      correctedBeats[i - 1].notes.length;
    const currAvg =
      correctedBeats[i].notes.reduce((s, n) => s + n.fret, 0) / correctedBeats[i].notes.length;
    // Allow larger jumps now that riffs can traverse the neck
    if (Math.abs(currAvg - prevAvg) > 7) {
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
