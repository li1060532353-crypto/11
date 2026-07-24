import { Container } from '../ui/Container';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <div>
          <p>© {new Date().getFullYear()} namdw. 保持好奇，持续记录。</p>
          <p className="site-footer__context">工程学习、推导与复盘</p>
        </div>
        <nav aria-label="页脚导航">
          <ul className="nav-list">
            <li>
              <a className="nav-link" href="/posts">
                文章索引
              </a>
            </li>
            <li>
              <a className="nav-link" href="/projects">
                项目目录
              </a>
            </li>
            <li>
              <a className="nav-link" href="/about">
                关于作者
              </a>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
