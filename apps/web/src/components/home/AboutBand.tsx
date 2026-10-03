import { Container } from '../ui/Container';

export function AboutBand() {
  return (
    <section className="about-band" aria-labelledby="about-title">
      <Container className="about-band__inner">
        <div>
          <p className="about-band__eyebrow">独立记录，持续构建</p>
          <h2 id="about-title">工程、学习与长期主义。</h2>
        </div>
        <div className="about-band__content">
          <p>
            记录推导、实验与实现过程中值得再次查阅的问题。从硬件、信号与系统到软件开发，留下真实的尝试，以及能够被验证的理解。
          </p>
          <a className="link-cta" href="/about">
            关于作者与这些记录
            <span className="link-cta__chevron" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      </Container>
    </section>
  );
}
