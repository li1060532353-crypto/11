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
  return (
    <form className="filter-bar" aria-label="文章筛选" onSubmit={(event) => event.preventDefault()}>
      <label>
        分类
        <select
          value={query.category ?? ''}
          onChange={(event) => onChange('category', event.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        标签
        <select value={query.tag ?? ''} onChange={(event) => onChange('tag', event.target.value)}>
          <option value="">全部标签</option>
          {tags.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        年份
        <select
          value={query.year?.toString() ?? ''}
          onChange={(event) => onChange('year', event.target.value)}
        >
          <option value="">全部年份</option>
          {[2026, 2025].map((year) => (
            <option key={year} value={year}>
              {year} 年
            </option>
          ))}
        </select>
      </label>
      <Link to={clearTo}>清除筛选</Link>
    </form>
  );
}
