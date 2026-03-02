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

  const prompt = `You are a guitar tab composer. Compose a guitar part for the following song.

Song: "${req.songTitle}" by ${req.artistName}
Key: ${analysis.key}
Capo: ${analysis.capoPosition}
Tempo: ${analysis.tempo} BPM
Chord progression: ${chordList}
${req.style ? `Style: ${req.style}` : 'Style: arpeggio'}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: beginner'}

String index mapping (CRITICAL — use exactly these numbers):
- stringIndex 5 = low E string (6th string, thickest)
- stringIndex 4 = A string (5th string)
- stringIndex 3 = D string (4th string)
- stringIndex 2 = G string (3rd string)
- stringIndex 1 = B string (2nd string)
- stringIndex 0 = high e string (1st string, thinnest)

Rules:
- fret must be 0–24
- durationBeats must be positive (use 1 for quarter notes, 0.5 for eighth notes)
- Generate one note per beat across the full chord progression
- Choose frets that actually form the given chords in standard tuning
- patternName: a short descriptive name for the pattern (e.g. "fingerpicked-arpeggio")

Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation. The JSON must match exactly:
{
  "patternName": "<short pattern name>",
  "notes": [
    { "stringIndex": <0-5>, "fret": <0-24>, "durationBeats": <positive number> },
    ...one note per beat
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
  console.log('  notes count:', result.notes.length);

  return result;
}
