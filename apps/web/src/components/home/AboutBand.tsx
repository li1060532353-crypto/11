import { Container } from '../ui/Container';

export function AboutBand() {
  return (
    <section className="about-band" aria-labelledby="about-title">
      <Container className="about-band__inner">
        <div>
          <p className="eyebrow">About this space</p>
          <h2 id="about-title">工程、学习与长期主义。</h2>
        </div>
        <div className="about-band__content">
          <p>
            我是一名电子信息工程学习者。这里记录从硬件、信号与系统到软件开发的真实过程：问题、推导、失败，以及最终能够被验证的方案。
          </p>
          <a className="link-cta" href="/about">
            了解更多
            <span className="link-cta__chevron" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      </Container>
    </section>
  );
}
