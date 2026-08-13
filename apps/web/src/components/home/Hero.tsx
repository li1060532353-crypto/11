import { Container } from '../ui/Container';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Container>
        <div className="hero__copy">
          <p className="eyebrow">Engineer · Creator · Explorer</p>
          <h1 id="hero-title">
            让复杂知识，
            <br />
            变得清晰。
          </h1>
          <p className="hero__lede">
            记录电子信息、软件开发与工程实践，让每一次学习都留下可以复用的答案。
          </p>
          <div className="hero__actions">
            <a className="link-cta" href="/posts">
              浏览最新文章
              <span className="link-cta__chevron" aria-hidden="true">
                ›
              </span>
            </a>
            <a className="link-cta" href="/projects">
              查看项目
              <span className="link-cta__chevron" aria-hidden="true">
                ›
              </span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
