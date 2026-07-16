import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { FallbackNotice } from '../components/content/FallbackNotice';
import { Container } from '../components/ui/Container';
import { listProjects } from '../content/contentGateway';
import { siteContent } from '../content/site';
import { useContentQuery } from '../content/useContentQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

import { PageIntro } from './PageIntro';

export function ProjectsPage() {
  const load = useMemo(() => () => listProjects(), []);
  const query = useContentQuery(load, [load]);
  const projects = query.result?.data ?? [];
  const selectedProjects = projects.filter((project) => project.selected);
  const description = '记录从嵌入式系统到软件工程的实践项目。';

  useDocumentMeta({ title: `项目 | ${siteContent.name}`, description });

  return (
    <>
      <PageIntro title="项目" description={description} eyebrow="Portfolio" />
      <Container className="portfolio-page">
        {query.state === 'loading' ? <p role="status">正在加载项目…</p> : null}
        {query.result?.source === 'fallback' ? <FallbackNotice error={query.result.error} /> : null}
        {selectedProjects.length ? (
          <p className="portfolio-page__selected" aria-label="精选项目">
            精选项目：{selectedProjects.map((project) => project.name).join('、')}
          </p>
        ) : null}
        <div className="project-grid">
          {projects.map((project) => (
            <article
              className="project-card"
              key={project.slug}
              aria-labelledby={`project-${project.slug}`}
            >
              <div className="project-card__body">
                <p className="project-card__eyebrow">
                  {project.selected ? '精选项目' : '实践项目'}
                </p>
                <h2 id={`project-${project.slug}`}>
                  <Link to={`/projects/${project.slug}`}>{project.name}</Link>
                </h2>
                <p>{project.summary}</p>
                <ul className="technology-list" aria-label={`${project.name} 使用的技术`}>
                  {project.technologies.map((technology) => (
                    <li key={technology}>{technology}</li>
                  ))}
                </ul>
                {project.sourceUrl || project.demoUrl ? (
                  <p className="project-card__links">
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
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
