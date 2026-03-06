import { parties, provinces } from '../data/constants';

export default function ResultsTable({ seats, provinceSeats }) {
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
