import { Container } from '../ui/Container';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <p>© {new Date().getFullYear()} namdw. 保持好奇，持续记录。</p>
        <nav aria-label="页脚导航">
          <ul className="nav-list">
            <li>
              <a className="nav-link" href="/posts">
                浏览文章
              </a>
            </li>
            <li>
              <a className="nav-link" href="/projects">
                查看项目
              </a>
            </li>
            <li>
              <a className="nav-link" href="/about">
                认识我
              </a>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
