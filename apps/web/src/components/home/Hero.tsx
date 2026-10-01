import { Container } from '../ui/Container';
import { EngineeringGridBackdrop } from './EngineeringGridBackdrop';
import { MicroprocessorSchematic } from './MicroprocessorSchematic';

export function Hero() {
  return (
    <section className="hero editorial-hero" aria-labelledby="hero-title">
      <EngineeringGridBackdrop />
      <Container>
        <div className="editorial-hero__grid">
          <div className="editorial-hero__content">
            <div className="editorial-hero__meta">
              <span>EMBEDDED &amp; SOFTWARE SYSTEMS</span>
              <span className="editorial-hero__sep" aria-hidden="true">
                ·
              </span>
              <span>8 MIN READ</span>
            </div>
            <h1 id="hero-title" className="editorial-hero__title">
              让复杂知识，变得清晰。
            </h1>
            <div className="editorial-hero__lede-group">
              <p className="editorial-hero__lede">
                记录电子信息、嵌入式系统与工程实践中的学习和思考。
              </p>
              <p className="editorial-hero__sublede">
                把学习中的推导、实验和复盘整理成可以持续验证的工程笔记。
              </p>
            </div>
            <div className="hero__actions editorial-hero__action">
              <a className="link-cta" href="/posts">
                浏览最新文章
                <span className="link-cta__chevron" aria-hidden="true">
                  ›
                </span>
              </a>
            </div>
          </div>
          <figure className="editorial-hero__visual">
            <MicroprocessorSchematic />
            <figcaption className="editorial-hero__caption">3D IC / 总线拓扑架构图</figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
