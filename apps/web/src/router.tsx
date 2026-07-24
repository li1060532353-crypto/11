import { lazy, Suspense, type ReactNode } from 'react';
import { matchRoutes, Route, Routes, useLocation } from 'react-router-dom';

import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { useScrollToTop } from './hooks/useScrollToTop';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import {
  getPostBySlug,
  listCategories,
  listProjects,
  listTags,
  toTaxonomySlug,
} from './content/contentQueries';
import { siteContent } from './content/site';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ArchivesPage } from './pages/posts/ArchivesPage';
import { CategoryIndexPage } from './pages/posts/CategoryIndexPage';
import { CategoryPostsPage } from './pages/posts/CategoryPostsPage';
import { PostsPage } from './pages/posts/PostsPage';
import { PostDetailPage } from './pages/posts/PostDetailPage';
import { SearchPage } from './pages/posts/SearchPage';
import { TagIndexPage } from './pages/posts/TagIndexPage';
import { TagPostsPage } from './pages/posts/TagPostsPage';

const KnowledgeDashboardRoute = lazy(() => import('./knowledge/KnowledgeDashboardRoute').then((module) => ({ default: module.KnowledgeDashboardRoute })));
const KnowledgeNotesRoute = lazy(() => import('./knowledge/KnowledgeNotesRoute').then((module) => ({ default: module.KnowledgeNotesRoute })));
const KnowledgeEditorRoute = lazy(() => import('./knowledge/KnowledgeEditorRoute').then((module) => ({ default: module.KnowledgeEditorRoute })));

function KnowledgeRouteBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="knowledge-message" role="status">Loading knowledge workspace</p>}>{children}</Suspense>;
}

export const publicRoutes = [
  { path: '/', element: <HomePage /> },
  { path: '/posts', element: <PostsPage /> },
  {
    path: '/posts/:slug',
    element: <PostDetailPage />,
  },
  { path: '/categories', element: <CategoryIndexPage /> },
  {
    path: '/categories/:slug',
    element: <CategoryPostsPage />,
  },
  { path: '/tags', element: <TagIndexPage /> },
  {
    path: '/tags/:slug',
    element: <TagPostsPage />,
  },
  {
    path: '/archives',
    element: <ArchivesPage />,
  },
  { path: '/projects', element: <ProjectsPage /> },
  { path: '/projects/:slug', element: <ProjectDetailPage /> },
  { path: '/about', element: <AboutPage /> },
  {
    path: '/search',
    element: <SearchPage />,
  },
  { path: '/knowledge', element: <KnowledgeRouteBoundary><KnowledgeDashboardRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes', element: <KnowledgeRouteBoundary><KnowledgeNotesRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes/new', element: <KnowledgeRouteBoundary><KnowledgeEditorRoute mode="create" /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes/:id', element: <KnowledgeRouteBoundary><KnowledgeEditorRoute mode="edit" /></KnowledgeRouteBoundary> },
  { path: '*', element: <NotFoundPage /> },
] as const;

function routeMeta(pathname: string): { title: string; description: string } {
  const match = matchRoutes([...publicRoutes], pathname)?.at(-1);
  const routePath = match?.route.path ?? '*';
  const slug = match?.params.slug ?? '';

  if (routePath === '/knowledge') return { title: 'Knowledge dashboard', description: 'Private knowledge workspace' };
  if (routePath === '/knowledge/notes') return { title: 'Notes', description: 'Private knowledge workspace notes' };

  if (routePath === '/posts/:slug') {
    const post = getPostBySlug(slug);
    return post
      ? {
          title: post.seoTitle ?? post.title,
          description: post.seoDescription ?? post.summary,
        }
      : { title: '未找到文章', description: '这篇文章不存在，或许已经被移动。' };
  }
  if (routePath === '/categories/:slug') {
    return listCategories().some((item) => item.slug === toTaxonomySlug(slug))
      ? { title: '分类', description: siteContent.description }
      : { title: '未找到分类', description: '这个分类不存在，或许已经被移除。' };
  }
  if (routePath === '/tags/:slug') {
    return listTags().some((item) => item.slug === toTaxonomySlug(slug))
      ? { title: '标签', description: siteContent.description }
      : { title: '未找到标签', description: '这个标签不存在，或许已经被移除。' };
  }
  if (routePath === '/projects/:slug') {
    const project = listProjects().find((item) => item.slug === slug);
    return project
      ? { title: project.name, description: project.summary }
      : { title: '未找到项目', description: '这个项目不存在，或许已经被移除。' };
  }

  const metadata: Record<string, { title: string; description: string }> = {
    '/': { title: siteContent.name, description: siteContent.description },
    '/posts': { title: '文章', description: siteContent.description },
    '/categories': { title: '分类', description: siteContent.description },
    '/tags': { title: '标签', description: siteContent.description },
    '/archives': { title: '归档', description: siteContent.description },
    '/projects': { title: '项目', description: '记录从嵌入式系统到软件工程的实践项目。' },
    '/about': { title: siteContent.about.title, description: siteContent.about.summary },
    '/search': { title: '搜索', description: siteContent.description },
  };
  return (
    metadata[routePath] ?? {
      title: '页面不存在',
      description: '你访问的页面不存在，或许已经被移动。',
    }
  );
}

function RouteShell() {
  useScrollToTop();
  const { pathname } = useLocation();
  const meta = routeMeta(pathname);
  useDocumentMeta({
    title: meta.title === siteContent.name ? meta.title : `${meta.title} | ${siteContent.name}`,
    description: meta.description,
  });

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <SiteHeader />
      <main id="main-content">
        <Routes>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </main>
      <SiteFooter />
    </>
  );
}

export function AppRoutes() {
  return <RouteShell />;
}
