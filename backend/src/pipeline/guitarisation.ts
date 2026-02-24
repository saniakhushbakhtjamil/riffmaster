import type {
  CompositionResult,
  GenerateTabRequest,
  GuitarisationResult,
  TabModel
} from '@riffmaster/shared';

export async function runGuitarisationStep(
  composition: CompositionResult,
  req: GenerateTabRequest
): Promise<GuitarisationResult> {
  const model: TabModel = {
    tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
    tempo: req.tempo,
    timeSignature: req.timeSignature ?? '4/4',
    notes: composition.notes
  };

  return { tab: model };
}

