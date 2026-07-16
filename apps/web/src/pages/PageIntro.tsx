import type { ReactNode } from 'react';

import { Container } from '../components/ui/Container';

type PageIntroProps = {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function PageIntro({ title, description, eyebrow, action }: PageIntroProps) {
  return (
    <section className="page-intro">
      <Container className="page-intro__inner">
        <div className="page-intro__content">
          {eyebrow ? <p className="page-intro__eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p className="page-intro__description">{description}</p>
        </div>
        {action ? <div className="page-intro__action">{action}</div> : null}
      </Container>
    </section>
  );
}
