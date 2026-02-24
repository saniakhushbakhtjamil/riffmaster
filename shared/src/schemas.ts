import { z } from 'zod';

export const chordBeatSchema = z.object({
  chord: z.string().min(1),
  beats: z.number().int().min(1)
});

export const analysisResultSchema = z.object({
  key: z.string().min(1),
  capoPosition: z.number().int().min(0).max(12),
  chordProgression: z.array(chordBeatSchema).min(1)
});

export const tabNoteSchema = z.object({
  stringIndex: z.number().int().min(0).max(5),
  fret: z.number().int().min(0).max(24),
  durationBeats: z.number().positive()
});

export const tabModelSchema = z.object({
  tuning: z.tuple([
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string()
  ]),
  tempo: z.number().int().min(40).max(240),
  timeSignature: z.string().optional(),
  notes: z.array(tabNoteSchema)
});

export const compositionResultSchema = z.object({
  patternName: z.string().min(1),
  notes: z.array(tabNoteSchema)
});

export const guitarisationResultSchema = z.object({
  tab: tabModelSchema
});

export const pipelineStepNameSchema = z.enum(['analysis', 'composition', 'guitarisation']);

export const pipelineStepInfoBaseSchema = z.object({
  name: pipelineStepNameSchema,
  fromCache: z.boolean(),
  durationMs: z.number().int().nonnegative()
});

export const analysisStepInfoSchema = pipelineStepInfoBaseSchema.extend({
  name: z.literal('analysis'),
  output: analysisResultSchema
});

export const compositionStepInfoSchema = pipelineStepInfoBaseSchema.extend({
  name: z.literal('composition'),
  output: compositionResultSchema
});

export const guitarisationStepInfoSchema = pipelineStepInfoBaseSchema.extend({
  name: z.literal('guitarisation'),
  output: guitarisationResultSchema
});

export const generateTabRequestSchema = z.object({
  songTitle: z.string().min(1).max(200),
  artistName: z.string().min(1).max(200),
  tempo: z.number().int().min(40).max(220),
  timeSignature: z.string().optional(),
  style: z.enum(['strumming', 'arpeggio', 'fingerstyle']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
});

export const generateTabResponseSchema = z.object({
  tab: z.object({
    ascii: z.string().min(1),
    model: tabModelSchema
  }),
  metadata: z.object({
    songTitle: z.string().min(1),
    artistName: z.string().min(1),
    tempo: z.number().int().min(40).max(220),
    key: z.string().min(1),
    capoPosition: z.number().int().min(0).max(12),
    chordProgression: z.array(chordBeatSchema).min(1),
    createdAt: z.string().min(1)
  }),
  steps: z.object({
    analysis: analysisStepInfoSchema,
    composition: compositionStepInfoSchema,
    guitarisation: guitarisationStepInfoSchema
  }),
  warnings: z.array(z.string()).optional()
});

