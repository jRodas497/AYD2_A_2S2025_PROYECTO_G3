function Reports() {
  return (
    <div className="reports-container">

      {/* ENCABEZADO */}
      <div className="reports-header">
        <div>
          <h1>Reportes y métricas</h1>
          <p>
            Análisis general del comportamiento de las operaciones
          </p>
        </div>

        <select className="period-select">
          <option>Últimos 30 días</option>
          <option>Últimos 90 días</option>
          <option>Este año</option>
        </select>
      </div>

      {/* TARJETAS */}
      <div className="reports-stats">

        <div className="report-stat">
          <span>Ventas totales</span>
          <strong>Q45,280</strong>
          <small className="positive">
            ↑ 8.4%
          </small>
        </div>

        <div className="report-stat">
          <span>Órdenes</span>
          <strong>128</strong>
          <small className="positive">
            ↑ 12%
          </small>
        </div>

        <div className="report-stat">
          <span>Ticket promedio</span>
          <strong>Q353.75</strong>
          <small className="positive">
            ↑ 4.2%
          </small>
        </div>

        <div className="report-stat">
          <span>Incidencias</span>
          <strong>7</strong>
          <small className="negative">
            ↓ 2.1%
          </small>
        </div>

      </div>

      {/* GRÁFICAS */}
      <div className="reports-grid">

        {/* VENTAS */}
        <div className="report-panel">
          <div className="report-panel-header">
            <div>
              <h2>Ventas mensuales</h2>
              <p>Ingresos registrados por mes</p>
            </div>
          </div>

          <div className="bar-chart">

            <div className="chart-y">
              <span>50K</span>
              <span>40K</span>
              <span>30K</span>
              <span>20K</span>
              <span>10K</span>
              <span>0</span>
            </div>

            <div className="chart-area">

              <div className="grid-line line-1"></div>
              <div className="grid-line line-2"></div>
              <div className="grid-line line-3"></div>
              <div className="grid-line line-4"></div>
              <div className="grid-line line-5"></div>

              <div className="bars">

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "45%" }}
                  ></div>
                  <span>Ene</span>
                </div>

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "58%" }}
                  ></div>
                  <span>Feb</span>
                </div>

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "72%" }}
                  ></div>
                  <span>Mar</span>
                </div>

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "65%" }}
                  ></div>
                  <span>Abr</span>
                </div>

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "82%" }}
                  ></div>
                  <span>May</span>
                </div>

                <div className="bar-column">
                  <div
                    className="bar"
                    style={{ height: "92%" }}
                  ></div>
                  <span>Jun</span>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* ESTADO DE ORDENES */}
        <div className="report-panel">

          <div className="report-panel-header">
            <div>
              <h2>Estado de órdenes</h2>
              <p>Distribución de órdenes actuales</p>
            </div>
          </div>

          <div className="pie-section">

            <div className="pie-chart">
              <div className="pie-center">
                <strong>128</strong>
                <span>Órdenes</span>
              </div>
            </div>

            <div className="pie-legend">

              <div>
                <span className="legend-dot paid"></span>
                <span>Pagadas</span>
                <strong>62%</strong>
              </div>

              <div>
                <span className="legend-dot shipping"></span>
                <span>En envío</span>
                <strong>23%</strong>
              </div>

              <div>
                <span className="legend-dot pending"></span>
                <span>Pendientes</span>
                <strong>15%</strong>
              </div>

            </div>

          </div>

        </div>

        {/* ÓRDENES */}
        <div className="report-panel">

          <div className="report-panel-header">
            <div>
              <h2>Órdenes por mes</h2>
              <p>Cantidad de órdenes procesadas</p>
            </div>
          </div>

          <div className="orders-bars">

            <div className="horizontal-bar">
              <div className="horizontal-label">
                Enero
              </div>

              <div className="horizontal-track">
                <div
                  className="horizontal-fill"
                  style={{ width: "48%" }}
                ></div>
              </div>

              <strong>48</strong>
            </div>

            <div className="horizontal-bar">
              <div className="horizontal-label">
                Febrero
              </div>

              <div className="horizontal-track">
                <div
                  className="horizontal-fill"
                  style={{ width: "62%" }}
                ></div>
              </div>

              <strong>62</strong>
            </div>

            <div className="horizontal-bar">
              <div className="horizontal-label">
                Marzo
              </div>

              <div className="horizontal-track">
                <div
                  className="horizontal-fill"
                  style={{ width: "75%" }}
                ></div>
              </div>

              <strong>75</strong>
            </div>

            <div className="horizontal-bar">
              <div className="horizontal-label">
                Abril
              </div>

              <div className="horizontal-track">
                <div
                  className="horizontal-fill"
                  style={{ width: "88%" }}
                ></div>
              </div>

              <strong>88</strong>
            </div>

            <div className="horizontal-bar">
              <div className="horizontal-label">
                Mayo
              </div>

              <div className="horizontal-track">
                <div
                  className="horizontal-fill"
                  style={{ width: "96%" }}
                ></div>
              </div>

              <strong>96</strong>
            </div>

          </div>

        </div>

        {/* INVENTARIO */}
        <div className="report-panel">

          <div className="report-panel-header">
            <div>
              <h2>Estado del inventario</h2>
              <p>Disponibilidad de productos</p>
            </div>
          </div>

          <div className="inventory-report">

            <div className="inventory-report-item">

              <div className="inventory-info">
                <span className="inventory-dot available"></span>
                <span>Disponible</span>
              </div>

              <strong>82%</strong>

            </div>

            <div className="inventory-progress">
              <div
                className="inventory-progress-fill available-fill"
                style={{ width: "82%" }}
              ></div>
            </div>


            <div className="inventory-report-item">

              <div className="inventory-info">
                <span className="inventory-dot reserved"></span>
                <span>Reservado</span>
              </div>

              <strong>12%</strong>

            </div>

            <div className="inventory-progress">
              <div
                className="inventory-progress-fill reserved-fill"
                style={{ width: "12%" }}
              ></div>
            </div>


            <div className="inventory-report-item">

              <div className="inventory-info">
                <span className="inventory-dot low"></span>
                <span>Bajo stock</span>
              </div>

              <strong>6%</strong>

            </div>

            <div className="inventory-progress">
              <div
                className="inventory-progress-fill low-fill"
                style={{ width: "6%" }}
              ></div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Reports;