function RecentOrders() {
  const orders = [
    {
      id: "#ORD-1024",
      customer: "Carlos López",
      date: "23 Sep, 2026",
      amount: "Q1,250.00",
      status: "Pagada",
      statusClass: "paid",
    },
    {
      id: "#ORD-1023",
      customer: "María García",
      date: "23 Sep, 2026",
      amount: "Q850.00",
      status: "Envío",
      statusClass: "shipping",
    },
    {
      id: "#ORD-1022",
      customer: "José Martínez",
      date: "22 Sep, 2026",
      amount: "Q2,100.00",
      status: "Pendiente",
      statusClass: "pending",
    },
    {
      id: "#ORD-1021",
      customer: "Ana Rodríguez",
      date: "22 Sep, 2026",
      amount: "Q640.00",
      status: "Pagada",
      statusClass: "paid",
    },
  ];

  return (
    <div className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h2>Órdenes recientes</h2>
          <p>Últimas órdenes registradas</p>
        </div>

        <button className="view-all">
          Ver todas →
        </button>
      </div>

      <div className="orders-list">
        {orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div className="order-main">
              <div className="order-icon">
                🛒
              </div>

              <div>
                <strong>{order.id}</strong>
                <span>{order.customer}</span>
              </div>
            </div>

            <div className="order-date">
              {order.date}
            </div>

            <div className="order-amount">
              {order.amount}
            </div>

            <span className={`order-status ${order.statusClass}`}>
              {order.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentOrders;