import { PageSignalFrame } from './components/ui/PageSignalFrame';
import { lazy, Suspense, type ReactNode } from 'react';
import { LoginPage } from './auth/LoginPage';
import { RequireOwner } from './auth/RequireOwner';
import { matchRoutes, Route, Routes, useLocation } from 'react-router-dom';

import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { useScrollToTop } from './hooks/useScrollToTop';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { useViewTransition } from './hooks/useViewTransition';
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
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(module => ({ default: module.ProjectDetailPage })));
import { ArchivesPage } from './pages/posts/ArchivesPage';
import { CategoryIndexPage } from './pages/posts/CategoryIndexPage';
import { CategoryPostsPage } from './pages/posts/CategoryPostsPage';
import { PostsPage } from './pages/posts/PostsPage';
const PostDetailPage = lazy(() => import('./pages/posts/PostDetailPage').then(module => ({ default: module.PostDetailPage })));
import { SearchPage } from './pages/posts/SearchPage';
import { TagIndexPage } from './pages/posts/TagIndexPage';
import { TagPostsPage } from './pages/posts/TagPostsPage';

const KnowledgeCreateRoute = lazy(() => import('./knowledge/KnowledgeCreateRoute').then((module) => ({ default: module.KnowledgeCreateRoute })));
const KnowledgeDashboardRoute = lazy(() => import('./knowledge/KnowledgeDashboardRoute').then((module) => ({ default: module.KnowledgeDashboardRoute })));
const KnowledgeNotesRoute = lazy(() => import('./knowledge/KnowledgeNotesRoute').then((module) => ({ default: module.KnowledgeNotesRoute })));
const KnowledgeEditorRoute = lazy(() => import('./knowledge/KnowledgeEditorRoute').then((module) => ({ default: module.KnowledgeEditorRoute })));
const KnowledgeImportRoute = lazy(() => import('./knowledge/KnowledgeImportRoute').then((module) => ({ default: module.KnowledgeImportRoute })));
const KnowledgeNoteReadRoute = lazy(() => import('./knowledge/KnowledgeNoteReadRoute').then((module) => ({ default: module.KnowledgeNoteReadRoute })));

function KnowledgeRouteBoundary({ children }: { children: ReactNode }) {
  return <RequireOwner><Suspense fallback={<p className="knowledge-message" role="status">Loading knowledge workspace</p>}>{children}</Suspense></RequireOwner>;
}

export const publicRoutes = [
  { path: '/login', element: <LoginPage /> },
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
  { path: '/knowledge/create', element: <KnowledgeRouteBoundary><KnowledgeCreateRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/import', element: <KnowledgeRouteBoundary><KnowledgeImportRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes', element: <KnowledgeRouteBoundary><KnowledgeNotesRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes/new', element: <KnowledgeRouteBoundary><KnowledgeEditorRoute mode="create" /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes/:id/read', element: <KnowledgeRouteBoundary><KnowledgeNoteReadRoute /></KnowledgeRouteBoundary> },
  { path: '/knowledge/notes/:id', element: <KnowledgeRouteBoundary><KnowledgeEditorRoute mode="edit" /></KnowledgeRouteBoundary> },
  { path: '*', element: <NotFoundPage /> },
] as const;

function routeMeta(pathname: string): { title: string; description: string } {
  const match = matchRoutes([...publicRoutes], pathname)?.at(-1);
  const routePath = match?.route.path ?? '*';
  const slug = match?.params.slug ?? '';

  if (routePath === '/knowledge') return { title: '知识库概览', description: '技术知识库工作区与统计概览' };
  if (routePath === '/knowledge/create') return { title: '新建文档', description: '上传 Markdown 文件或自行编辑文档' };
  if (routePath === '/knowledge/import') return { title: '导入 Markdown', description: '导入并检查 Markdown 文档' };
  if (routePath === '/knowledge/notes') return { title: '文章管理', description: '知识库文章列表与状态管理' };
  if (routePath === '/knowledge/notes/new') return { title: '新建文章', description: '撰写新的技术文章或工程笔记' };
  if (routePath === '/knowledge/notes/:id') return { title: '编辑文章', description: '编辑技术文章与元数据' };
  if (routePath === '/knowledge/notes/:id/read') return { title: '阅读文章', description: '知识库文章工程阅读视图' };

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
    '/login': { title: '登录知识库', description: '登录后管理文章、导入笔记与上传附件' },
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
  useViewTransition();
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
        {pathname !== '/' ? <PageSignalFrame reading={/^\/posts\/.+/.test(pathname) || pathname.endsWith('/read')} /> : null}
        <Suspense fallback={<p role="status">正在加载页面…</p>}><Routes>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes></Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

export function AppRoutes() {
  return <RouteShell />;
}
