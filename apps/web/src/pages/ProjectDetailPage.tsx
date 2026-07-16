import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { FallbackNotice } from '../components/content/FallbackNotice';
import { Container } from '../components/ui/Container';
import { getProjectBySlug } from '../content/contentGateway';
import { siteContent } from '../content/site';
import { useContentQuery } from '../content/useContentQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

import { NotFoundPage } from './NotFoundPage';
import { PageIntro } from './PageIntro';

export function ProjectDetailPage() {
  const { slug = '' } = useParams();
  const load = useMemo(() => () => getProjectBySlug(slug), [slug]);
  const query = useContentQuery(load, [load]);
  const project = query.result?.data;
  useDocumentMeta(
    query.state === 'loading'
      ? {
          title: `正在加载项目 | ${siteContent.name}`,
          description: '正在加载项目内容。',
        }
      : project
        ? { title: `${project.name} | ${siteContent.name}`, description: project.summary }
        : {
            title: `未找到项目 | ${siteContent.name}`,
            description: '这个项目不存在，或许已经被移除。',
          },
  );

  if (query.state === 'loading') {
    return (
      <>
        <PageIntro title="项目" description="正在加载项目内容。" eyebrow="Project" />
        <Container className="project-detail">
          <p role="status">正在加载项目…</p>
        </Container>
      </>
    );
  }

  if (!project) return <NotFoundPage resource="project" />;

  return (
    <>
      <PageIntro title={project.name} description={project.summary} eyebrow="Project" />
      <Container className="project-detail">
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        <section aria-labelledby="project-detail-content">
          <h2 id="project-detail-content">项目说明</h2>
          <pre className="project-detail__body">{project.body}</pre>
        </section>
        <section aria-labelledby="project-detail-technologies">
          <h2 id="project-detail-technologies">技术栈</h2>
          <ul className="technology-list" aria-label={`${project.name} 使用的技术`}>
            {project.technologies.map((technology) => (
              <li key={technology}>{technology}</li>
            ))}
          </ul>
        </section>
        {project.sourceUrl || project.demoUrl ? (
          <section aria-label="项目链接" className="project-card__links">
            {project.sourceUrl ? (
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`查看${project.name}源代码`}
              >
                源代码
              </a>
            ) : null}
            {project.demoUrl ? (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`查看${project.name}演示`}
              >
                查看演示
              </a>
            ) : null}
          </section>
        ) : null}
      </Container>
    </>
  );
}
