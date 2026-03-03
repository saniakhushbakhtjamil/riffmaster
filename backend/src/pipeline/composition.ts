import { compositionResultSchema } from '@riffmaster/shared';
import type { AnalysisResult, CompositionResult, GenerateTabRequest } from '@riffmaster/shared';
import { getAnthropicClient } from '../services/anthropic.js';
import {
  computeChordVoicings,
  computeScalePositions,
  formatVoicingsForPrompt,
  formatScaleForPrompt,
} from './voicing.js';

export async function runCompositionStep(
  analysis: AnalysisResult,
  req: GenerateTabRequest,
): Promise<CompositionResult> {
  const client = getAnthropicClient();

  const voicings = computeChordVoicings(analysis);
  const scale = computeScalePositions(analysis);
  const voicingBlock = formatVoicingsForPrompt(voicings);
  const scaleBlock = formatScaleForPrompt(scale);
  const totalBeats = analysis.chordProgression.reduce((sum, c) => sum + c.beats, 0);
  const style = req.style ?? 'arpeggio';

  const prompt = `You are a creative guitar arranger writing for an intermediate guitarist. Compose an expressive, musical guitar part — not just chord arpeggios, but real guitar playing with riffs, licks, and fills.

Song: "${req.songTitle}" by ${req.artistName}
Key: ${analysis.key}
Capo: ${analysis.capoPosition}
Tempo: ${analysis.tempo} BPM
Style: ${style}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: intermediate'}
Total beats to fill: ${totalBeats}
Playing guide: ${analysis.playingGuide}

--- STRING INDEX REFERENCE ---
stringIndex 5 = low E (6th string, thickest)
stringIndex 4 = A (5th string)
stringIndex 3 = D (4th string)
stringIndex 2 = G (3rd string)
stringIndex 1 = B (2nd string)
stringIndex 0 = high e (1st string, thinnest)

--- HARMONIC LAYER: chord voicings (frets 0–4) ---
Use these on beat 1 of each chord and for strummed/arpeggiated moments.

${voicingBlock}

--- MELODIC LAYER: scale positions (frets 0–12) ---
Use these freely for riffs, licks, fills, and single-note runs.

${scaleBlock}

--- HOW TO MIX THE TWO LAYERS ---
Think of the tab in two parts:

1. CHORD BEATS — anchor beat 1 of each chord with a bass note or chord tone from the harmonic layer. Use arpeggios or strums from the voicing positions.

2. MELODIC BEATS — use the remaining beats creatively:
   - RIFF: a repeated single-note motif that drives the song forward (use scale positions, can go up to fret 12)
   - LICK: a short melodic phrase (3–6 notes) that decorates a chord change — fast, expressive
   - FILL: a run or phrase that bridges two chords, often descending or ascending the scale
   - Vary fret positions — don't stay at frets 0–4 the whole time

${
  style === 'strumming'
    ? `STRUMMING STYLE: strum chords on main beats, then add single-note fills on the off-beats or before chord changes.`
    : `FINGERPICKING STYLE: alternate bass notes (strings 5, 4) with melodic runs on treble strings (2, 1, 0). Insert licks and riffs on the upper strings between chord changes.`
}

--- OUTPUT FORMAT ---
Beat groups — each group is one time slot. Multiple notes = played simultaneously.
- durationBeats on the group (1 = quarter note, 0.5 = eighth note, 0.25 = sixteenth)
- Sum of all durationBeats must equal ${totalBeats}
- Shorter note values (0.5, 0.25) make riffs feel fast and expressive

patternName: describe what you composed (e.g. "pentatonic-riff-with-arpeggio", "fingerpick-and-lick")
arrangementNotes: 3–5 sentences explaining (1) how to physically play this arrangement — hand positions, techniques, any tricky transitions — and (2) why it is arranged this way musically — what gives it character, how it serves the song.

Respond with ONLY a valid JSON object — no markdown, no code fences:
{
  "patternName": "<short pattern name>",
  "arrangementNotes": "<3–5 sentences on how to play and why it is arranged this way>",
  "beats": [
    { "durationBeats": 1, "notes": [{ "stringIndex": 5, "fret": 0 }] },
    { "durationBeats": 0.5, "notes": [{ "stringIndex": 2, "fret": 7 }] },
    { "durationBeats": 0.5, "notes": [{ "stringIndex": 1, "fret": 8 }] }
  ]
}`;

  const params = {
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user' as const, content: prompt }],
  };

  console.log('\n[composition] → sending to Claude:');
  console.log('  model:', params.model);
  console.log('  style:', style, '| totalBeats:', totalBeats);
  console.log('  scale:', scale.scaleName, '| tones:', scale.tones.join(' '));
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
