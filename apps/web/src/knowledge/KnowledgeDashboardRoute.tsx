import { useEffect, useState } from 'react';
import { DashboardPage } from '../knowledge-ui/DashboardPage';
import type { ExtendedDashboardViewModel } from '../knowledge-ui/DashboardPage';
import { mapNoteToCard, mapStatsToDashboard } from './knowledge-adapter';
import { loadKnowledgeNotes, loadKnowledgeStats } from './knowledge-api';

export function KnowledgeDashboardRoute() {
  const [model, setModel] = useState<ExtendedDashboardViewModel | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    Promise.all([loadKnowledgeStats(), loadKnowledgeNotes({ page: 1, pageSize: 4 })])
      .then(([stats, notes]) => {
        if (active) {
          const base = mapStatsToDashboard(stats, notes.items);
          const drafts = notes.items
            .filter((item) => 'status' in item && item.status === 'draft')
            .map(mapNoteToCard);
          setModel({
            ...base,
            statistics: [
              {
                label: '总文章数',
                value: String(stats.total),
                detail: '全部知识库文章',
              },
              {
                label: '草稿',
                value: String(stats.draft),
                detail: '待继续完善的创作草稿',
              },
              {
                label: '已发布',
                value: String(stats.published),
                detail: '已发布并提供阅读',
              },
              {
                label: '已归档',
                value: String(stats.archived),
                detail: '历史封存文章',
              },
            ],
            recentDrafts: drafts,
          });
          setState('ready');
        }
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return model ? <DashboardPage model={model} state={state} /> : <DashboardPage state={state} />;
}
