import {
  type AnalysisResult,
  type CompositionResult,
  type GenerateTabRequest,
  type GenerateTabResponse,
  type GuitarisationResult
} from '@riffmaster/shared';

import { createCacheClient, getAnalysisCacheKey, getCompositionCacheKey, getGuitarisationCacheKey } from '../services/cache.js';
import { renderAsciiTab } from '../tab/renderAsciiTab.js';
import { runAnalysisStep } from './analysis.js';
import { runCompositionStep } from './composition.js';
import { runGuitarisationStep } from './guitarisation.js';

export async function runGenerateTabPipeline(
  req: GenerateTabRequest
): Promise<GenerateTabResponse> {
  const cache = createCacheClient();

  const analysisKey = getAnalysisCacheKey(req);
  const compositionKeyBase = 'composition';
  const guitarisationKeyBase = 'guitarisation';

  const timings: { [K in 'analysis' | 'composition' | 'guitarisation']?: number } = {};

  let analysisFromCache = false;
  let compositionFromCache = false;
  let guitarisationFromCache = false;

  let analysis: AnalysisResult;
  const analysisStart = Date.now();
  const cachedAnalysis = await cache.get(analysisKey);
  if (cachedAnalysis) {
    analysis = JSON.parse(cachedAnalysis) as AnalysisResult;
    analysisFromCache = true;
  } else {
    analysis = await runAnalysisStep(req);
    await cache.set(analysisKey, JSON.stringify(analysis), 60 * 60);
  }
  timings.analysis = Date.now() - analysisStart;

  const compositionKey = getCompositionCacheKey(analysis);
  let composition: CompositionResult;
  const compositionStart = Date.now();
  const cachedComposition = await cache.get(compositionKey);
  if (cachedComposition) {
    composition = JSON.parse(cachedComposition) as CompositionResult;
    compositionFromCache = true;
  } else {
    composition = await runCompositionStep(analysis);
    await cache.set(compositionKey, JSON.stringify(composition), 60 * 60);
  }
  timings.composition = Date.now() - compositionStart;

  const guitarisationKey = getGuitarisationCacheKey(composition);
  let guitarisation: GuitarisationResult;
  const guitarisationStart = Date.now();
  const cachedGuitarisation = await cache.get(guitarisationKey);
  if (cachedGuitarisation) {
    guitarisation = JSON.parse(cachedGuitarisation) as GuitarisationResult;
    guitarisationFromCache = true;
  } else {
    guitarisation = await runGuitarisationStep(composition, req);
    await cache.set(guitarisationKey, JSON.stringify(guitarisation), 60 * 60);
  }
  timings.guitarisation = Date.now() - guitarisationStart;

  const ascii = renderAsciiTab(guitarisation.tab);

  const response: GenerateTabResponse = {
    tab: {
      ascii,
      model: guitarisation.tab
    },
    metadata: {
      songTitle: req.songTitle,
      artistName: req.artistName,
      tempo: req.tempo,
      key: analysis.key,
      capoPosition: analysis.capoPosition,
      chordProgression: analysis.chordProgression,
      createdAt: new Date().toISOString()
    },
    steps: {
      analysis: {
        name: 'analysis',
        fromCache: analysisFromCache,
        durationMs: timings.analysis ?? 0,
        output: analysis
      },
      composition: {
        name: 'composition',
        fromCache: compositionFromCache,
        durationMs: timings.composition ?? 0,
        output: composition
      },
      guitarisation: {
        name: 'guitarisation',
        fromCache: guitarisationFromCache,
        durationMs: timings.guitarisation ?? 0,
        output: guitarisation
      }
    },
    warnings: []
  };

  return response;
}

