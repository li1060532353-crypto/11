import { Link } from 'react-router-dom';
import { useId } from 'react';

export function EmptyState({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="empty-state ui-empty-state">
      <h2 id={headingId}>{title}</h2>
      <p>{description}</p>
      <Link className="button-link" to={href}>
        {linkLabel}
      </Link>
    </section>
  );
}
