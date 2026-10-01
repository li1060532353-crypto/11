import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate, useInRouterContext } from 'react-router-dom';

import { searchSpotlight, type SpotlightGroup, type SpotlightItem } from './spotlightIndex';

const ICONS: Record<SpotlightItem['icon'], string> = {
  article: '📝',
  project: '📂',
  category: '🏷️',
  tag: '🔖',
  nav: '→',
};

function flatItems(groups: SpotlightGroup[]): SpotlightItem[] {
  return groups.flatMap((g) => g.items);
}

function useSafeNavigate() {
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : null;

  return useCallback(
    (href: string) => {
      if (navigate) {
        navigate(href);
      } else if (typeof window !== 'undefined') {
        window.location.href = href;
      }
    },
    [navigate],
  );
}

export function SpotlightModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const safeNavigate = useSafeNavigate();

  const groups = searchSpotlight(query);
  const items = flatItems(groups);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const activeId = items[activeIndex]?.id;
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-spotlight-id="${activeId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, items]);

  const go = useCallback(
    (item: SpotlightItem) => {
      safeNavigate(item.href);
      onClose();
    },
    [safeNavigate, onClose],
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      go(items[activeIndex]);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  let globalIndex = 0;

  return (
    <div
      className="spotlight-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="spotlight-panel"
        role="dialog"
        aria-modal="true"
        aria-label="快捷搜索"
      >
        <div className="spotlight-search">
          <svg
            className="spotlight-search__icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="spotlight-search__input"
            type="text"
            placeholder="搜索文章、项目、分类…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索"
            aria-activedescendant={items[activeIndex]?.id}
            aria-controls="spotlight-results"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
          <kbd className="spotlight-kbd">Esc</kbd>
        </div>

        <div
          id="spotlight-results"
          ref={listRef}
          className="spotlight-results"
          role="listbox"
        >
          {groups.length === 0 && query.trim() ? (
            <div className="spotlight-empty">
              没有找到与 &ldquo;{query}&rdquo; 相关的结果
            </div>
          ) : null}
          {groups.map((group) => (
            <div key={group.label} className="spotlight-group">
              <div className="spotlight-group__label" role="presentation">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isCurrent = globalIndex === activeIndex;
                const idx = globalIndex;
                globalIndex++;
                return (
                  <div
                    key={item.id}
                    id={item.id}
                    data-spotlight-id={item.id}
                    className={`spotlight-item${isCurrent ? ' spotlight-item--active' : ''}`}
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => go(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className="spotlight-item__icon" aria-hidden="true">
                      {ICONS[item.icon]}
                    </span>
                    <span className="spotlight-item__text">
                      <span className="spotlight-item__title">{item.title}</span>
                      {item.subtitle ? (
                        <span className="spotlight-item__subtitle">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {isCurrent ? (
                      <span className="spotlight-item__enter" aria-hidden="true">
                        ↵
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="spotlight-footer" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 导航
          </span>
          <span>
            <kbd>↵</kbd> 打开
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  );
}
