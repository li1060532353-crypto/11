import { siteContent } from '../content/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

import { PageIntro } from './PageIntro';

export type RouteStubProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function RouteStub({ title, description, eyebrow }: RouteStubProps) {
  useDocumentMeta({ title: `${title} | ${siteContent.name}`, description });

  return <PageIntro title={title} description={description} {...(eyebrow ? { eyebrow } : {})} />;
}
