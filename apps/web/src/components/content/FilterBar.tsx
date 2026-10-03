import { ThemeSelect } from '../ui/ThemeSelect';
import { useId, useState } from 'react';
import { useMobileViewport } from '../../hooks/useMobileViewport';
import { Link } from 'react-router-dom';

import type { Category, Tag } from '../../content/contentQueries';
import type { PostQuery } from '../../content/queryParams';

type FilterBarProps = {
  query: PostQuery;
  categories: readonly Category[];
  tags: readonly Tag[];
  onChange: (key: 'category' | 'tag' | 'year', value: string) => void;
  clearTo: string;
};

export function FilterBar({ query, categories, tags, onChange, clearTo }: FilterBarProps) {
  const mobile = useMobileViewport();
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  const activeCount = [query.category, query.tag, query.year].filter(Boolean).length;
  return (
    <form className="filter-bar" aria-label="文章筛选" onSubmit={(event) => event.preventDefault()}>
      {mobile ? (
        <button
          className="filter-bar__toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={controlsId}
          onClick={() => setExpanded(!expanded)}
        >
          <span>筛选{activeCount ? ` · 已选 ${activeCount} 项` : ''}</span>
          <span>{expanded ? '收起' : '展开'}</span>
        </button>
      ) : null}
      <div className="filter-bar__controls" id={controlsId} hidden={mobile && !expanded}>
        <ThemeSelect label="分类" value={query.category ?? ''}
          options={[{ value: '', label: '全部分类' }, ...categories.map((item) => ({ value: item.slug, label: item.name }))]}
          onChange={(value) => onChange('category', value)} />
        <ThemeSelect label="标签" value={query.tag ?? ''}
          options={[{ value: '', label: '全部标签' }, ...tags.map((item) => ({ value: item.slug, label: item.name }))]}
          onChange={(value) => onChange('tag', value)} />
        <ThemeSelect label="年份" value={query.year?.toString() ?? ''}
          options={[{ value: '', label: '全部年份' }, ...[2026, 2025].map((year) => ({ value: String(year), label: `${year} 年` }))]}
          onChange={(value) => onChange('year', value)} />
        <Link to={clearTo}>清除筛选</Link>
      </div>
    </form>
  );
}
