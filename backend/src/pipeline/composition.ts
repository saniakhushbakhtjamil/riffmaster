import type {
  AnalysisResult,
  CompositionResult,
  TabNote
} from '@ai-guitar-composer/shared';

export async function runCompositionStep(analysis: AnalysisResult): Promise<CompositionResult> {
  const notes: TabNote[] = [];

  const basePattern: Array<{ stringIndex: number; fret: number }> = [
    { stringIndex: 5, fret: 3 },
    { stringIndex: 4, fret: 2 },
    { stringIndex: 3, fret: 0 },
    { stringIndex: 2, fret: 0 }
  ];

  for (const chordBeat of analysis.chordProgression) {
    for (let beat = 0; beat < chordBeat.beats; beat += 1) {
      const patternNote = basePattern[beat % basePattern.length];
      notes.push({
        stringIndex: patternNote.stringIndex,
        fret: patternNote.fret,
        durationBeats: 1
      });
    }
  }

  return {
    patternName: 'beginner-arpeggio',
    notes
  };
}

