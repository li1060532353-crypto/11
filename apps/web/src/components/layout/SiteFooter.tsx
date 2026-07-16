import { Container } from '../ui/Container';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <p>© {new Date().getFullYear()} namdw. 保持好奇，持续记录。</p>
        <a href="/about">了解更多</a>
      </Container>
    </footer>
  );
}
