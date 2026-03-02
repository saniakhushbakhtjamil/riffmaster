import { useState } from 'react';

import type { AnalysisResult, GenerateTabRequest, GenerateTabResponse, TabModel } from '@riffmaster/shared';

import { analyseTab, generateTab } from './api/client';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import { ChordForm } from './components/ChordForm';
import { TabDisplay } from './components/TabDisplay';

export function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [asciiTab, setAsciiTab] = useState<string | null>(null);
  const [tabModel, setTabModel] = useState<TabModel | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(payload: GenerateTabRequest): Promise<void> {
    try {
      setError(null);
      setAnalysis(null);
      setAsciiTab(null);
      setTabModel(null);

      // Phase 1: analyse
      setIsAnalysing(true);
      const analysisResult = await analyseTab(payload);
      setAnalysis(analysisResult);
      setIsAnalysing(false);

      // Phase 2: compose + guitarise
      setIsComposing(true);
      const response: GenerateTabResponse = await generateTab(payload);
      setAsciiTab(response.tab.ascii);
      setTabModel(response.tab.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAnalysing(false);
      setIsComposing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-12 pt-10">
        <ChordForm onSubmit={handleGenerate} isLoading={isAnalysing || isComposing} />
        <AnalysisDisplay analysis={analysis} isLoading={isAnalysing} />
        <TabDisplay
          ascii={asciiTab}
          model={tabModel}
          isLoading={isComposing}
          error={error}
        />
      </main>
    </div>
  );
}
