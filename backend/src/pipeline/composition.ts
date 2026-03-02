import { compositionResultSchema } from '@riffmaster/shared';
import type {
  AnalysisResult,
  CompositionResult,
  GenerateTabRequest,
} from '@riffmaster/shared';
import { getAnthropicClient } from '../services/anthropic.js';

export async function runCompositionStep(
  analysis: AnalysisResult,
  req: GenerateTabRequest,
): Promise<CompositionResult> {
  const client = getAnthropicClient();

  const chordList = analysis.chordProgression
    .map((c) => `${c.chord} (${c.beats} beats)`)
    .join(', ');

  const totalBeats = analysis.chordProgression.reduce((sum, c) => sum + c.beats, 0);
  const style = req.style ?? 'arpeggio';

  const prompt = `You are a guitar tab composer. Compose a guitar part for the following song.

Song: "${req.songTitle}" by ${req.artistName}
Key: ${analysis.key}
Capo: ${analysis.capoPosition}
Tempo: ${analysis.tempo} BPM
Chord progression: ${chordList}
Total beats to fill: ${totalBeats}
Style: ${style}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: beginner'}

String index mapping (CRITICAL — use exactly these numbers):
- stringIndex 5 = low E string (6th string, thickest)
- stringIndex 4 = A string (5th string)
- stringIndex 3 = D string (4th string)
- stringIndex 2 = G string (3rd string)
- stringIndex 1 = B string (2nd string)
- stringIndex 0 = high e string (1st string, thinnest)

OUTPUT FORMAT — beat groups:
Each element in "beats" is a time slot. Multiple notes in one slot are played simultaneously.
- durationBeats goes on the GROUP (not on individual notes)
- Use 1 for quarter notes, 0.5 for eighth notes
- The sum of all durationBeats must equal ${totalBeats}
- Choose frets that form the correct chords in standard tuning

Style guidance:
- arpeggio / fingerstyle: 1–3 notes per beat in a rolling pattern across strings
- strumming: 4–6 strings per beat struck simultaneously

patternName: a short descriptive name (e.g. "fingerpicked-arpeggio", "folk-strum")

Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation:
{
  "patternName": "<short pattern name>",
  "beats": [
    { "durationBeats": 1, "notes": [{ "stringIndex": 5, "fret": 0 }] },
    { "durationBeats": 1, "notes": [{ "stringIndex": 3, "fret": 2 }, { "stringIndex": 2, "fret": 0 }] }
  ]
}`;

  const params = {
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    thinking: { type: 'adaptive' as const },
    messages: [{ role: 'user' as const, content: prompt }],
  };

  console.log('\n[composition] → sending to Claude:');
  console.log('  model:', params.model);
  console.log('  prompt:\n' + prompt.split('\n').map((l) => '    ' + l).join('\n'));

  const response = await client.messages.create(params);

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in composition response from Claude');
  }

  console.log('[composition] ← received from Claude:');
  console.log('  stop_reason:', response.stop_reason);
  console.log('  usage:', response.usage);
  console.log('  raw text (truncated):', textBlock.text.slice(0, 300));

  const raw: unknown = JSON.parse(textBlock.text.trim());
  const result = compositionResultSchema.parse(raw);

  console.log('  patternName:', result.patternName);
  console.log('  beats count:', result.beats.length);

  return result;
}
