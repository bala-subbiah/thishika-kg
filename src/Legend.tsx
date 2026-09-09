export default function Legend({ customHome }: { customHome: boolean }) {
  return (
    <div className="legend" aria-hidden="true">
      <span className="legend-item">
        <i className="legend-pin legend-pin--scheme" /> Joining scheme
      </span>
      <span className="legend-item">
        <i className="legend-pin legend-pin--open" /> Not joining
      </span>
      <span className="legend-item">
        <i className="legend-pin legend-pin--home" />{" "}
        {customHome ? "Home (drag to move)" : "Casa Brava (drag to move)"}
      </span>
      <span className="legend-note">Pin numbers rank by distance from home</span>
    </div>
  );
}
