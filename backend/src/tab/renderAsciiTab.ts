import type { TabModel } from '@riffmaster/shared';

export function renderAsciiTab(model: TabModel): string {
  const timeSignature = model.timeSignature ?? '4/4';
  const beatsPerBar = parseInt(timeSignature.split('/')[0], 10) || 4;

  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

  // Build columns: each entry is either a beat-group column or a bar separator
  type Column = { type: 'beat'; cells: string[] } | { type: 'bar' };
  const columns: Column[] = [];

  let cumulativeBeats = 0;

  for (const group of model.beats) {
    // Insert bar separator before this beat if we're crossing a bar boundary
    if (cumulativeBeats > 0 && cumulativeBeats % beatsPerBar === 0) {
      columns.push({ type: 'bar' });
    }

    // Determine column width: max fret digit length across all notes, minimum 2
    const maxFretLen = group.notes.reduce(
      (max, n) => Math.max(max, String(n.fret).length),
      1,
    );
    const colWidth = Math.max(maxFretLen, 2);

    // Build a cell for each of the 6 strings (index 0 = high e, 5 = low E)
    const cells: string[] = Array(6).fill('-'.repeat(colWidth));

    for (const note of group.notes) {
      const rowIndex = 5 - note.stringIndex;
      const fretStr = String(note.fret);
      // Right-pad fret number with dashes to colWidth
      cells[rowIndex] = fretStr.padEnd(colWidth, '-');
    }

    columns.push({ type: 'beat', cells });
    cumulativeBeats += group.durationBeats;
  }

  // Render 6 rows
  const rows: string[] = STRING_NAMES.map((name, rowIndex) => {
    const segments = columns.map((col) => {
      if (col.type === 'bar') return '|';
      return col.cells[rowIndex];
    });
    return `${name}|${segments.join('')}|`;
  });

  return rows.join('\n') + '\n';
}
