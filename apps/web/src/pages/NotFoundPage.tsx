import { Link } from 'react-router-dom';

import { siteContent } from '../content/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

import { PageIntro } from './PageIntro';

type NotFoundResource = 'page' | 'article' | 'category' | 'tag' | 'project';

const resourceContent: Record<
  NotFoundResource,
  { title: string; description: string; index?: { href: string; label: string } }
> = {
  page: { title: '页面不存在', description: '你访问的页面不存在，或许已经被移动。' },
  article: {
    title: '未找到文章',
    description: '这篇文章不存在，或许已经被移动。',
    index: { href: '/posts', label: '浏览全部文章' },
  },
  category: {
    title: '未找到分类',
    description: '这个分类不存在，或许已经被移除。',
    index: { href: '/categories', label: '浏览全部分类' },
  },
  tag: {
    title: '未找到标签',
    description: '这个标签不存在，或许已经被移除。',
    index: { href: '/tags', label: '浏览全部标签' },
  },
  project: {
    title: '未找到项目',
    description: '这个项目不存在，或许已经被移除。',
    index: { href: '/projects', label: '浏览全部项目' },
  },
};

export function NotFoundPage({ resource = 'page' }: { resource?: NotFoundResource }) {
  const { title, description, index } = resourceContent[resource];
  useDocumentMeta({ title: `${title} | ${siteContent.name}`, description });

  return (
    <PageIntro
      title={title}
      description={description}
      eyebrow="404"
      action={
        <nav className="not-found-links" aria-label="恢复导航">
          <Link to="/">返回首页</Link>
          {index?.href === '/posts' ? (
            <Link to={index.href}>{index.label}</Link>
          ) : (
            <Link to="/posts">浏览文章</Link>
          )}
          {index && index.href !== '/posts' ? <Link to={index.href}>{index.label}</Link> : null}
        </nav>
      }
    />
  );
}
