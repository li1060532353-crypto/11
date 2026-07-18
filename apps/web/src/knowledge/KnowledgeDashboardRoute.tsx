import { useEffect, useState } from 'react';
import { DashboardPage } from '../knowledge-ui/DashboardPage';
import { dashboardFixture } from '../knowledge-ui/fixtures';
import { mapStatsToDashboard } from './knowledge-adapter';
import { loadKnowledgeStats } from './knowledge-api';
export function KnowledgeDashboardRoute() { const [model, setModel] = useState(dashboardFixture); useEffect(() => { let active = true; loadKnowledgeStats().then((stats) => { if (active) setModel(mapStatsToDashboard(stats)); }).catch(() => undefined); return () => { active = false; }; }, []); return <DashboardPage model={model} />; }
