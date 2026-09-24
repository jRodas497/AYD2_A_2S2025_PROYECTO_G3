function StatCard({
  title,
  value,
  description,
  icon,
  type,
}) {
  return (
    <div className={`stat-card ${type}`}>
      <div className="stat-card-top">
        <div>
          <span className="stat-title">{title}</span>
          <h2>{value}</h2>
        </div>

        <div className="stat-icon">
          {icon}
        </div>
      </div>

      <div className="stat-description">
        {description}
      </div>
    </div>
  );
}

export default StatCard;