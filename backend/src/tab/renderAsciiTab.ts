import type { TabModel } from '@riffmaster/shared';

export function renderAsciiTab(model: TabModel): string {
  const beats = model.notes.reduce((max, note) => max + note.durationBeats, 0);
  const totalColumns = Math.max(beats, 1);

  const lines: string[][] = Array.from({ length: 6 }, () =>
    Array.from({ length: totalColumns }, () => '-')
  );

  let currentBeatIndex = 0;

  for (const note of model.notes) {
    const column = currentBeatIndex;
    if (column >= totalColumns) break;

    const lineIndex = 5 - note.stringIndex;
    const fretText = String(note.fret);

    for (let i = 0; i < fretText.length && column + i < totalColumns; i += 1) {
      lines[lineIndex][column + i] = fretText[i];
    }

    currentBeatIndex += note.durationBeats;
  }

  const stringNames = ['E', 'A', 'D', 'G', 'B', 'e'];

  const renderedLines = lines
    .map((cols, idx) => {
      const label = stringNames[idx];
      return `${label}|${cols.join('')}`;
    })
    .join('\n');

  return `${renderedLines}\n`;
}

