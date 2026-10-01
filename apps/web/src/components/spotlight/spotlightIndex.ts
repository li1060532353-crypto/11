import {
  listCategories,
  listPosts,
  listProjects,
  listTags,
} from '../../content/contentQueries';

export type SpotlightGroup = {
  label: string;
  items: SpotlightItem[];
};

export type SpotlightItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  group: string;
  icon: 'article' | 'project' | 'category' | 'tag' | 'nav';
};

const navigationItems: SpotlightItem[] = [
  { id: 'nav-posts', title: '文章列表', href: '/posts', group: '快捷导航', icon: 'nav' },
  { id: 'nav-projects', title: '项目目录', href: '/projects', group: '快捷导航', icon: 'nav' },
  { id: 'nav-knowledge', title: '知识库', href: '/knowledge', group: '快捷导航', icon: 'nav' },
  { id: 'nav-categories', title: '分类索引', href: '/categories', group: '快捷导航', icon: 'nav' },
  { id: 'nav-tags', title: '标签索引', href: '/tags', group: '快捷导航', icon: 'nav' },
  { id: 'nav-archives', title: '文章归档', href: '/archives', group: '快捷导航', icon: 'nav' },
  { id: 'nav-about', title: '关于作者', href: '/about', group: '快捷导航', icon: 'nav' },
  { id: 'nav-search', title: '文章高级搜索', href: '/search', group: '快捷导航', icon: 'nav' },
];

function buildFullIndex(): SpotlightItem[] {
  const posts = listPosts({ pageSize: 999 }).items.map((p) => ({
    id: `post-${p.slug}`,
    title: p.title,
    subtitle: `${p.category} · ${p.readingTime} 分钟`,
    href: `/posts/${p.slug}`,
    group: '文章',
    icon: 'article' as const,
  }));

  const projects = listProjects().map((p) => ({
    id: `project-${p.slug}`,
    title: p.name,
    subtitle: p.technologies.slice(0, 3).join(' · '),
    href: `/projects/${p.slug}`,
    group: '项目',
    icon: 'project' as const,
  }));

  const categories = listCategories().map((c) => ({
    id: `cat-${c.slug}`,
    title: c.name,
    subtitle: `${c.count} 篇`,
    href: `/categories/${c.slug}`,
    group: '分类',
    icon: 'category' as const,
  }));

  const tags = listTags().map((t) => ({
    id: `tag-${t.slug}`,
    title: t.name,
    subtitle: `${t.count} 篇`,
    href: `/tags/${t.slug}`,
    group: '标签',
    icon: 'tag' as const,
  }));

  return [...posts, ...projects, ...categories, ...tags, ...navigationItems];
}

export function searchSpotlight(query: string): SpotlightGroup[] {
  const all = buildFullIndex();
  const q = query.trim().toLowerCase();

  const filtered = q
    ? all.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle?.toLowerCase().includes(q) ?? false),
      )
    : navigationItems;

  const groupMap = new Map<string, SpotlightItem[]>();
  for (const item of filtered) {
    const list = groupMap.get(item.group) ?? [];
    list.push(item);
    groupMap.set(item.group, list);
  }

  const order = ['文章', '项目', '分类', '标签', '快捷导航'];
  const groups: SpotlightGroup[] = [];
  for (const label of order) {
    const items = groupMap.get(label);
    if (items?.length) {
      groups.push({ label, items: items.slice(0, 6) });
    }
  }

  return groups;
}
