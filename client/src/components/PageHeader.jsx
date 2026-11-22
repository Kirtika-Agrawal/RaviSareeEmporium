import { MenuButton } from './SideMenu';

export default function PageHeader({ eyebrow, title, onBack, onMenu, actions }) {
  return (
    <header className="page-header" style={{ padding: '12px 16px' }}>
      {/* Side columns share the leftover width, so the title stays centred
          whatever buttons sit on the right. */}
      <div className="page-header-grid">
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ justifySelf: 'start' }}>
          ← Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-sub" style={{ marginTop: 0 }}>{eyebrow}</div>
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="header-actions">
          {actions}
          <MenuButton onClick={onMenu} />
        </div>
      </div>
    </header>
  );
}
