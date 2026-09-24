import { useState } from "react";

function Header() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-menu">
          ☰
        </button>

        <div className="breadcrumb">
          <span>BackOffice</span>
          <span className="breadcrumb-separator">/</span>
          <strong>Dashboard</strong>
        </div>
      </div>

      <div className="header-right">
        <button className="notification-button">
          🔔
          <span className="notification-badge">3</span>
        </button>

        <div className="admin-profile">
          <div className="avatar">
            A
          </div>

          <div className="admin-info">
            <span className="admin-name">Administrador</span>
            <span className="admin-role">Admin</span>
          </div>

          <button
            className="profile-arrow"
            onClick={() => setShowMenu(!showMenu)}
          >
            ▼
          </button>

          {showMenu && (
            <div className="profile-menu">
              <button>👤 Mi perfil</button>
              <button>⚙ Configuración</button>
              <button>🚪 Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;