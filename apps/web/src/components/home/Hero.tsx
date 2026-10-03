import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { WorkbenchSchematic } from './WorkbenchSchematic';

export function Hero() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const search = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/search?${new URLSearchParams({ q: query.trim() })}`);
  };
  return (
    <section className="hero editorial-hero workbench-hero" aria-labelledby="hero-title">
      <Container>
        <div className="workbench-hero__coordinates" aria-hidden="true">
          <span>FIG. 01 / SIGNAL · STRUCTURE · SYSTEM</span>
          <span>NAMDW. / ENGINEERING FIELD NOTES</span>
        </div>
        <div className="editorial-hero__grid">
          <div className="editorial-hero__content">
            <div className="editorial-hero__meta">工程学习笔记</div>
            <h1 id="hero-title" className="editorial-hero__title">
              <span>从信号到系统，</span>
              <span>从理解<span className="editorial-hero__accent">到实现。</span></span>
            </h1>
            <div className="editorial-hero__lede-group">
              <p className="editorial-hero__lede">电子信息、嵌入式系统与工程实践。</p>
              <p className="editorial-hero__sublede">在推导与实践之间，建立自己的理解。</p>
            </div>
            <div className="hero__actions editorial-hero__action">
              <a className="workbench-primary" href="/posts">
                进入文章索引<span aria-hidden="true">↗</span>
              </a>
              <a className="workbench-secondary" href="/about">关于这些记录</a>
            </div>
            <form className="home-search" role="search" aria-label="首页文章搜索" onSubmit={search}>
              <label className="sr-only" htmlFor="home-article-search">搜索文章</label>
              <svg className="home-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
              </svg>
              <input
                id="home-article-search"
                type="search"
                role="searchbox"
                autoComplete="off"
                placeholder="搜索文章与工程记录…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button type="submit" variant="quiet" aria-label="搜索文章">搜索<span aria-hidden="true"> ↵</span></Button>
            </form>
          </div>
          <WorkbenchSchematic />
        </div>
        <div className="workbench-hero__footer">
          <a href="#home-records"><span aria-hidden="true">↓</span>从结构，进入记录</a>
          <span aria-hidden="true">SIGNALS / SYSTEMS / SOFTWARE</span>
        </div>
      </Container>
    </section>
  );
}
