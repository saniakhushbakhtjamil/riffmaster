import type {
  AnalysisResult,
  CompositionResult,
  GenerateTabRequest,
  GuitarisationResult,
  TabModel
} from '@riffmaster/shared';

export async function runGuitarisationStep(
  composition: CompositionResult,
  analysis: AnalysisResult,
  req: GenerateTabRequest
): Promise<GuitarisationResult> {
  const model: TabModel = {
    tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
    tempo: analysis.tempo,
    timeSignature: req.timeSignature ?? '4/4',
    beats: composition.beats
  };

  return { tab: model };
}

