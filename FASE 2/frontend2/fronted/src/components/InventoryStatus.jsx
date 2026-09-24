function InventoryStatus() {
  const inventory = [
    {
      name: "Disponible",
      percentage: 82,
      className: "available",
    },
    {
      name: "Reservado",
      percentage: 12,
      className: "reserved",
    },
    {
      name: "Bajo stock",
      percentage: 6,
      className: "low",
    },
  ];

  return (
    <div className="panel inventory-panel">
      <div className="panel-header">
        <div>
          <h2>Estado del inventario</h2>
          <p>Distribución actual del inventario</p>
        </div>

        <button className="more-button">
          ⋮
        </button>
      </div>

      <div className="inventory-chart">
        <div
          className="donut"
          style={{
            background: `conic-gradient(
              #2563eb 0% 82%,
              #f59e0b 82% 94%,
              #ef4444 94% 100%
            )`,
          }}
        >
          <div className="donut-center">
            <strong>100%</strong>
            <span>Total</span>
          </div>
        </div>
      </div>

      <div className="inventory-list">
        {inventory.map((item) => (
          <div className="inventory-item" key={item.name}>
            <div className="inventory-name">
              <span className={`inventory-dot ${item.className}`}></span>
              {item.name}
            </div>

            <strong>{item.percentage}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InventoryStatus;