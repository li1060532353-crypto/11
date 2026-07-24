import { useEffect, useState } from 'react';
import { DashboardPage } from '../knowledge-ui/DashboardPage';
import type { DashboardViewModel } from '../knowledge-ui/fixtures';
import { mapStatsToDashboard } from './knowledge-adapter';
import { loadKnowledgeNotes, loadKnowledgeStats } from './knowledge-api';
export function KnowledgeDashboardRoute() {
  const [model, setModel] = useState<DashboardViewModel | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    Promise.all([loadKnowledgeStats(), loadKnowledgeNotes({ page: 1, pageSize: 4 })])
      .then(([stats, notes]) => { if (active) { setModel(mapStatsToDashboard(stats, notes.items)); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  return model ? <DashboardPage model={model} state={state} /> : <DashboardPage state={state} />;
}
