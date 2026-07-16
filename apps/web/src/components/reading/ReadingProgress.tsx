import { useEffect, useState } from 'react';

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function ReadingProgress({ articleId = 'article-content' }: { articleId?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const article = document.getElementById(articleId);
      if (!article) {
        setProgress(0);
        return;
      }

      const bounds = article.getBoundingClientRect();
      const availableDistance = article.scrollHeight - window.innerHeight;
      const distanceRead = -bounds.top;
      const visibleHeight = Math.max(
        0,
        Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
      );
      const nextProgress =
        availableDistance <= 0
          ? bounds.top <= 0
            ? 100
            : (visibleHeight / Math.max(article.scrollHeight, bounds.height, 1)) * 100
          : (distanceRead / availableDistance) * 100;
      setProgress(Math.round(clamp(nextProgress)));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [articleId]);

  return (
    <div
      className="reading-progress"
      role="progressbar"
      aria-label="文章阅读进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span
        className="reading-progress__bar"
        aria-hidden="true"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
