import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
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
Tempo: ${req.tempo} BPM
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
- patternName: a short descriptive name for the pattern (e.g. "fingerpicked-arpeggio")`;

  const params = {
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    thinking: { type: 'adaptive' as const },
    messages: [{ role: 'user' as const, content: prompt }],
    output_config: {
      format: zodOutputFormat(compositionResultSchema),
    },
  };

  console.log('\n[composition] → sending to Claude:');
  console.log('  model:', params.model);
  console.log('  prompt:\n' + prompt.split('\n').map((l) => '    ' + l).join('\n'));

  const response = await client.messages.parse(params);

  console.log('[composition] ← received from Claude:');
  console.log('  stop_reason:', response.stop_reason);
  console.log('  usage:', response.usage);
  console.log('  parsed_output:', JSON.stringify(response.parsed_output, null, 2));

  if (!response.parsed_output) throw new Error('Claude returned no structured output for composition step');
  return response.parsed_output as CompositionResult;
}
