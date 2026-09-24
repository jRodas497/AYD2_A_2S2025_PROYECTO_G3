import { useState } from "react";
import Sidebar from "./components/Siderbar";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import RecentOrders from "./components/RecentOrders";
import InventoryStatus from "./components/InventoryStatus";
import Reports from "./components/Reports";
import "./App.css";

function App() {
  const [activeSection, setActiveSection] = useState("Dashboard");

  return (
    <div className="app">

      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <div className="main-container">

        <Header />

        <main className="content">

          {/* =========================
              DASHBOARD
          ========================= */}

          {activeSection === "Dashboard" && (
            <>
              <div className="page-header">

                <div>
                  <h1>Resumen general</h1>

                  <p>
                    Vista general de las operaciones administrativas
                  </p>
                </div>

                <button className="refresh-button">
                  ↻ Actualizar
                </button>

              </div>


              <section className="stats-grid">

                <StatCard
                  title="Órdenes"
                  value="128"
                  description="+12% este mes"
                  icon="🛒"
                  type="blue"
                />

                <StatCard
                  title="Ventas"
                  value="Q45,280"
                  description="+8.4% este mes"
                  icon="💰"
                  type="green"
                />

                <StatCard
                  title="Pendientes"
                  value="24"
                  description="Requieren atención"
                  icon="⏳"
                  type="orange"
                />

                <StatCard
                  title="Incidencias"
                  value="7"
                  description="3 sin resolver"
                  icon="⚠️"
                  type="red"
                />

              </section>


              <section className="dashboard-grid">

                <RecentOrders />

                <InventoryStatus />

              </section>
            </>
          )}


          {/* =========================
              REPORTES
          ========================= */}

          {activeSection === "Reportes" && (
            <Reports />
          )}


          {/* =========================
              OTROS MÓDULOS
          ========================= */}

          {activeSection !== "Dashboard" &&
            activeSection !== "Reportes" && (
              <section className="placeholder-page">

                <div className="placeholder-icon">
                  📋
                </div>

                <h1>
                  {activeSection}
                </h1>

                <p>
                  Módulo de{" "}
                  <strong>
                    {activeSection}
                  </strong>{" "}
                  pendiente de implementación.
                </p>

                <button
                  className="back-button"
                  onClick={() =>
                    setActiveSection("Dashboard")
                  }
                >
                  ← Volver al Dashboard
                </button>

              </section>
            )}

        </main>

      </div>

    </div>
  );
}

export default App;