import { useState } from 'react';

import type { GenerateTabRequest, GenerateTabResponse, TabModel } from '@riffmaster/shared';

import { generateTab } from './api/client';
import { ChordForm } from './components/ChordForm';
import { TabDisplay } from './components/TabDisplay';

export function App() {
  const [asciiTab, setAsciiTab] = useState<string | null>(null);
  const [tabModel, setTabModel] = useState<TabModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(payload: GenerateTabRequest): Promise<void> {
    try {
      setIsLoading(true);
      setError(null);
      setAsciiTab(null);
      setTabModel(null);

      const response: GenerateTabResponse = await generateTab(payload);
      setAsciiTab(response.tab.ascii);
      setTabModel(response.tab.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-12 pt-10">
        <ChordForm onSubmit={handleGenerate} isLoading={isLoading} />
        <TabDisplay ascii={asciiTab} model={tabModel} isLoading={isLoading} error={error} />
      </main>
    </div>
  );
}

