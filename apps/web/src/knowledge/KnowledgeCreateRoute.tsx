import { Link, useLocation } from 'react-router-dom';
import { KnowledgeShell } from '../knowledge-ui/KnowledgeShell';
import '../knowledge-ui/knowledge.css';

export function KnowledgeCreateRoute() {
  const location = useLocation();
  return <KnowledgeShell title="新建文档"><section className="knowledge-shell">
    <header className="knowledge-shell__heading"><Link to="/knowledge/notes">← 返回文章管理</Link>
      <h1>新建文档</h1><p>上传已有笔记，或从一段文字开始。</p></header>
    <div className="knowledge-create-options">
      <Link className="knowledge-create-option" to="/knowledge/import" state={location.state}>
        <h2>上传 Markdown 文件</h2><p>支持多文件导入，检查内容与公式后保存。</p><strong>选择文件 →</strong>
      </Link>
      <Link className="knowledge-create-option" to="/knowledge/notes/new?format=markdown" state={location.state}>
        <h2>自行编辑</h2><p>输入或粘贴 Markdown，实时预览排版与 LaTeX 公式。</p><strong>开始编辑 →</strong>
      </Link>
    </div>
  </section></KnowledgeShell>;
}
