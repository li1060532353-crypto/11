import type { ContentSourceError } from '../../content/types';

export function FallbackNotice({ error }: { error?: ContentSourceError | undefined }) {
  return (
    <div className="fallback-notice" role="status">
      <span className="fallback-notice__dot" aria-hidden="true" />
      <span className="fallback-notice__text">
        内容服务暂时不可用，正在显示本地缓存内容。
        {error?.message ? (
          <span className="fallback-notice__detail"> ({error.message})</span>
        ) : null}
      </span>
    </div>
  );
}
