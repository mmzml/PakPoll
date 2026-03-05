import { parties } from '../data/constants';

export default function ResultsTable({ seats }) {
  return (
    <div id="seats">
      <table className="results-table" id="resultsTable">
        <thead>
          <tr>
            <th>Party</th>
            {parties.map(p => <th key={p}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Seats</th>
            {seats.map((count, i) => (
              <td key={i} className="seats-num">{count}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
