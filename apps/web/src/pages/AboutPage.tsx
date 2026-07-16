import { Container } from '../components/ui/Container';
import { siteContent } from '../content/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

import { PageIntro } from './PageIntro';

const focusAreas = ['电子信息与嵌入式系统', '工程实践与可观测性', '软件工程与持续学习'];

export function AboutPage() {
  const { about } = siteContent;
  useDocumentMeta({ title: `${about.title} | ${siteContent.name}`, description: about.summary });

  return (
    <>
      <PageIntro title={about.title} description={about.summary} eyebrow="About" />
      <Container className="about-page">
        <section aria-labelledby="about-introduction-title">
          <h2 id="about-introduction-title">自我介绍</h2>
          <p>{about.summary}</p>
          <p>我把学习中的推导、实验和复盘整理成可以持续验证的工程笔记。</p>
        </section>
        <section aria-labelledby="about-focus-title">
          <h2 id="about-focus-title">关注方向</h2>
          <ul>
            {focusAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="about-contact-title">
          <h2 id="about-contact-title">联系我</h2>
          <ul className="contact-list">
            <li>
              <a href={about.contact.email}>发送邮件给 Namdw</a>
            </li>
            <li>
              <a href={about.contact.github} target="_blank" rel="noreferrer">
                访问 Namdw 的 GitHub
              </a>
            </li>
          </ul>
        </section>
      </Container>
    </>
  );
}
