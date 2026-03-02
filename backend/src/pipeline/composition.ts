import { compositionResultSchema } from '@riffmaster/shared';
import type { AnalysisResult, CompositionResult, GenerateTabRequest } from '@riffmaster/shared';
import { getAnthropicClient } from '../services/anthropic.js';
import { computeChordVoicings, formatVoicingsForPrompt } from './voicing.js';

export async function runCompositionStep(
  analysis: AnalysisResult,
  req: GenerateTabRequest,
): Promise<CompositionResult> {
  const client = getAnthropicClient();

  const voicings = computeChordVoicings(analysis);
  const voicingBlock = formatVoicingsForPrompt(voicings);
  const totalBeats = analysis.chordProgression.reduce((sum, c) => sum + c.beats, 0);
  const style = req.style ?? 'arpeggio';

  const prompt = `You are a guitar arranger for intermediate guitarists. Compose a guitar part that is musical and playable.

Song: "${req.songTitle}" by ${req.artistName}
Key: ${analysis.key}
Capo: ${analysis.capoPosition}
Tempo: ${analysis.tempo} BPM
Style: ${style}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: intermediate'}
Total beats to fill: ${totalBeats}

--- CHORD VOICINGS (pre-computed, accurate) ---
CRITICAL: You MUST only use the (stringIndex, fret) pairs listed below. Do not invent other frets.

${voicingBlock}

--- STRING INDEX REFERENCE ---
stringIndex 5 = low E (6th string, thickest)
stringIndex 4 = A (5th string)
stringIndex 3 = D (4th string)
stringIndex 2 = G (3rd string)
stringIndex 1 = B (2nd string)
stringIndex 0 = high e (1st string, thinnest)

--- OUTPUT FORMAT ---
Return beat groups. Each group is one time slot — multiple notes in a group are played simultaneously.
- durationBeats is on the group (1 = quarter note, 0.5 = eighth note)
- Sum of all durationBeats must equal ${totalBeats}
- Spend each chord's beats on notes from that chord's voicing only

--- STYLE GUIDANCE ---
${
  style === 'strumming'
    ? `Strumming: use 4–6 strings per beat struck simultaneously.
Bass note (string 5 or 4) on beat 1 of each chord.
Alternate bass/chord pattern for variety (e.g. bass on 1, strum on 2-3-4).`
    : `Arpeggio/fingerstyle: roll 1–3 notes per beat across strings in a repeating pattern.
Thumb (strings 5, 4, 3) for bass notes, fingers (strings 2, 1, 0) for melody.
Start each chord with its bass note, then roll upward through chord tones.
Vary the pattern slightly every 4 beats to keep it musical.`
}

patternName: a short descriptive name (e.g. "travis-pick", "folk-strum", "fingerpicked-arpeggio")

Respond with ONLY a valid JSON object — no markdown, no code fences:
{
  "patternName": "<short pattern name>",
  "beats": [
    { "durationBeats": 1, "notes": [{ "stringIndex": 5, "fret": 0 }] },
    { "durationBeats": 1, "notes": [{ "stringIndex": 3, "fret": 0 }, { "stringIndex": 2, "fret": 0 }] }
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
  console.log('  style:', style, '| totalBeats:', totalBeats);
  console.log('  voicings computed for', voicings.length, 'chords');

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
