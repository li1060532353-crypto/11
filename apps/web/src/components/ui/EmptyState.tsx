import { Link } from 'react-router-dom';

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
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button-link" to={href}>
        {linkLabel}
      </Link>
    </section>
  );
}
