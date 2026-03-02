import {
  analysisResultSchema,
  generateTabRequestSchema,
  generateTabResponseSchema,
  type AnalysisResult,
  type GenerateTabRequest,
  type GenerateTabResponse
} from '@riffmaster/shared';

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

export async function analyseTab(
  payload: GenerateTabRequest
): Promise<AnalysisResult> {
  const parsed = generateTabRequestSchema.parse(payload);

  const res = await fetch(`${getApiBaseUrl()}/api/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return analysisResultSchema.parse(await res.json());
}

export async function generateTab(
  payload: GenerateTabRequest
): Promise<GenerateTabResponse> {
  const parsed = generateTabRequestSchema.parse(payload);

  const res = await fetch(`${getApiBaseUrl()}/api/generate-tab`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(parsed)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return generateTabResponseSchema.parse(json);
}

