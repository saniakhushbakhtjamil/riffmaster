import { analysisResultSchema } from '@riffmaster/shared';
import type { AnalysisResult, GenerateTabRequest } from '@riffmaster/shared';
import { getAnthropicClient } from '../services/anthropic.js';

export async function runAnalysisStep(req: GenerateTabRequest): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  const prompt = `You are a music theory expert. Analyze the following song and return a guitar arrangement analysis.

Song: "${req.songTitle}" by ${req.artistName}
${req.style ? `Style: ${req.style}` : ''}
${req.difficulty ? `Difficulty: ${req.difficulty}` : ''}

Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation. The JSON must match exactly:
{
  "key": "<musical key, e.g. G major or A minor>",
  "capoPosition": <integer 0-12, where 0 means no capo>,
  "tempo": <integer BPM of the original song, 40-240>,
  "chordProgression": [
    { "chord": "<chord name>", "beats": <integer, typically 2 or 4> },
    ...4 to 8 chords total
  ],
  "strummingPattern": "<strumming pattern notation, e.g. D-DU-UDU or description like 'down on beats 1 and 3, up on 2 and 4'>",
  "playingGuide": "<2-3 sentences of practical advice for a beginner on how to play this song: hand position, chord transitions, timing tips>"
}`;

  const params = {
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' as const },
    messages: [{ role: 'user' as const, content: prompt }],
  };

  console.log('\n[analysis] → sending to Claude:');
  console.log('  model:', params.model);
  console.log('  prompt:\n' + prompt.split('\n').map((l) => '    ' + l).join('\n'));

  const response = await client.messages.create(params);

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in analysis response from Claude');
  }

  console.log('[analysis] ← received from Claude:');
  console.log('  stop_reason:', response.stop_reason);
  console.log('  usage:', response.usage);
  console.log('  raw text:', textBlock.text);

  const raw: unknown = JSON.parse(textBlock.text.trim());
  const result = analysisResultSchema.parse(raw);

  console.log('  parsed_output:', JSON.stringify(result, null, 2));

  return result;
}
