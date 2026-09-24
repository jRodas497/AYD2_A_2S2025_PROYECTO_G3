function Sidebar({ activeSection, setActiveSection }) {
  const menuSections = [
    {
      title: "Principal",
      items: [
        { name: "Dashboard", icon: "▦" },
      ],
    },
    {
      title: "Operaciones",
      items: [
        { name: "Órdenes", icon: "🛒" },
        { name: "Incidencias", icon: "⚠" },
        { name: "Devoluciones", icon: "↩" },
        { name: "Inventario", icon: "▣" },
        { name: "Reservas", icon: "▤" },
        { name: "Logística", icon: "🚚" },
        { name: "Seguimiento", icon: "⌖" },
      ],
    },
    {
      title: "Administración",
      items: [
        { name: "Clientes", icon: "♙" },
        { name: "Auditoría", icon: "◷" },
        { name: "Reportes", icon: "▥" },
        { name: "Configuración", icon: "⚙" },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">A</div>

        <div className="logo-text">
          <span className="logo-title">Admin</span>
          <span className="logo-subtitle">BackOffice</span>
        </div>
      </div>

      <nav className="navigation">
        {menuSections.map((section) => (
          <div className="menu-section" key={section.title}>
            <div className="menu-title">{section.title}</div>

            {section.items.map((item) => (
              <button
                key={item.name}
                className={`menu-item ${
                  activeSection === item.name ? "active" : ""
                }`}
                onClick={() => setActiveSection(item.name)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot"></span>

          <div>
            <span className="status-title">Sistema operativo</span>
            <span className="status-text">Todos los servicios activos</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;