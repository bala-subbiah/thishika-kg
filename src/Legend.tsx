export default function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <span className="legend-item">
        <i className="legend-pin legend-pin--scheme" /> Joining scheme
      </span>
      <span className="legend-item">
        <i className="legend-pin legend-pin--open" /> Not joining
      </span>
      <span className="legend-item">
        <i className="legend-pin legend-pin--home" /> Casa Brava
      </span>
      <span className="legend-note">Pin numbers rank by distance from home</span>
    </div>
  );
}
