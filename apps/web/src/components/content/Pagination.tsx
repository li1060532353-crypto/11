import { Link } from 'react-router-dom';

type PaginationProps = {
  page: number;
  totalPages: number;
  pathname: string;
  search: string;
  excludedKeys?: readonly string[];
};

function pageHref(pathname: string, search: string, page: number, excludedKeys: readonly string[]) {
  const params = new URLSearchParams(search);
  excludedKeys.forEach((key) => params.delete(key));
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const value = params.toString();
  return `${pathname}${value ? `?${value}` : ''}`;
}

export function Pagination({
  page,
  totalPages,
  pathname,
  search,
  excludedKeys = [],
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="分页">
      {page > 1 ? (
        <Link to={pageHref(pathname, search, page - 1, excludedKeys)}>上一页</Link>
      ) : null}
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
        <Link
          key={item}
          aria-current={item === page ? 'page' : undefined}
          to={pageHref(pathname, search, item, excludedKeys)}
        >
          {item}
        </Link>
      ))}
      {page < totalPages ? (
        <Link to={pageHref(pathname, search, page + 1, excludedKeys)}>下一页</Link>
      ) : null}
    </nav>
  );
}
