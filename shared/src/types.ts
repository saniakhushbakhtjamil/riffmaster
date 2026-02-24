import type {
  analysisResultSchema,
  analysisStepInfoSchema,
  compositionResultSchema,
  compositionStepInfoSchema,
  generateTabRequestSchema,
  generateTabResponseSchema,
  guitarisationResultSchema,
  guitarisationStepInfoSchema,
  pipelineStepNameSchema,
  tabModelSchema,
  tabNoteSchema,
  chordBeatSchema
} from './schemas';
import type { z } from 'zod';

export type PipelineStepName = z.infer<typeof pipelineStepNameSchema>;

export type ChordBeat = z.infer<typeof chordBeatSchema>;

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type CompositionResult = z.infer<typeof compositionResultSchema>;
export type GuitarisationResult = z.infer<typeof guitarisationResultSchema>;

export type TabNote = z.infer<typeof tabNoteSchema>;
export type TabModel = z.infer<typeof tabModelSchema>;

export type AnalysisStepInfo = z.infer<typeof analysisStepInfoSchema>;
export type CompositionStepInfo = z.infer<typeof compositionStepInfoSchema>;
export type GuitarisationStepInfo = z.infer<typeof guitarisationStepInfoSchema>;

export type GenerateTabRequest = z.infer<typeof generateTabRequestSchema>;
export type GenerateTabResponse = z.infer<typeof generateTabResponseSchema>;

