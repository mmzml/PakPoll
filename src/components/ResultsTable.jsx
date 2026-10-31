import { parties, provinces } from '../data/constants';

function formatChange(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '–';
}

export default function ResultsTable({ seats, baselineSeats, provinceSeats }) {
  return (
    <div id="seats" style={{ overflowX: 'auto', width: '100%' }}>
      <table className="results-table" id="resultsTable">
        <thead>
          <tr>
            <th>Province \ Party</th>
            {parties.map(p => <th key={p}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Total</th>
            {seats.map((count, i) => (
              <td key={i}>{count}</td>
            ))}
          </tr>
          <tr>
            <th>Change vs 2024</th>
            {seats.map((count, i) => {
              const change = count - baselineSeats[i];
              return (
                <td key={i} className={change > 0 ? 'seat-gain' : change < 0 ? 'seat-loss' : ''}>
                  {formatChange(change)}
                </td>
              );
            })}
          </tr>
          {provinceSeats && provinces.map(prov => (
            <tr key={prov}>
              <th>{prov}</th>
              {provinceSeats[prov].map((count, i) => (
                <td key={i}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
