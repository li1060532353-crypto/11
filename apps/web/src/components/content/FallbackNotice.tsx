import type { ContentSourceError } from '../../content/types';

export function FallbackNotice({ error }: { error?: ContentSourceError | undefined }) {
  return (
    <p className="fallback-notice" role="status">
      内容服务暂时不可用，正在显示本地缓存内容。
      {error?.message ? <span> {error.message}</span> : null}
    </p>
  );
}
