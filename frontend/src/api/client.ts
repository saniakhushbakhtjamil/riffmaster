import {
  generateTabRequestSchema,
  generateTabResponseSchema,
  type GenerateTabRequest,
  type GenerateTabResponse
} from '@riffmaster/shared';

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
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

