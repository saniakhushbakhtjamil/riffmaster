import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { analysisResultSchema } from '@riffmaster/shared';
import type { AnalysisResult, GenerateTabRequest } from '@riffmaster/shared';
import { getAnthropicClient } from '../services/anthropic.js';

export async function runAnalysisStep(req: GenerateTabRequest): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  const prompt = `You are a music theory expert. Analyze the following song and return a realistic guitar arrangement analysis.

Song: "${req.songTitle}" by ${req.artistName}
Tempo: ${req.tempo} BPM
${req.style ? `Style: ${req.style}` : ''}
${req.difficulty ? `Difficulty: ${req.difficulty}` : ''}

Return:
- key: the musical key (e.g. "G major", "A minor")
- capoPosition: capo fret 0–12 (0 = no capo)
- chordProgression: 4–8 chords that suit this song, each with a realistic beat count (2 or 4)`;

  const params = {
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' as const },
    messages: [{ role: 'user' as const, content: prompt }],
    output_config: {
      format: zodOutputFormat(analysisResultSchema),
    },
  };

  console.log('\n[analysis] → sending to Claude:');
  console.log('  model:', params.model);
  console.log('  prompt:\n' + prompt.split('\n').map((l) => '    ' + l).join('\n'));

  const response = await client.messages.parse(params);

  console.log('[analysis] ← received from Claude:');
  console.log('  stop_reason:', response.stop_reason);
  console.log('  usage:', response.usage);
  console.log('  parsed_output:', JSON.stringify(response.parsed_output, null, 2));

  if (!response.parsed_output) throw new Error('Claude returned no structured output for analysis step');
  return response.parsed_output as AnalysisResult;
}
