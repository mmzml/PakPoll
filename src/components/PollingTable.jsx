import { parties, provinces, baselineProvincialPct } from '../data/constants';

export default function PollingTable({ inputs, onChange, totals }) {
  return (
    <table className="polling-table" id="pollingTable">
      <thead>
        <tr>
          <th>Party</th>
          {provinces.map(p => <th key={p}>{p}</th>)}
        </tr>
      </thead>
      <tbody>
        {parties.map((party, pi) => (
          <tr key={party}>
            <td>{party}</td>
            {provinces.map((prov, provIdx) => (
              <td key={prov}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={(baselineProvincialPct[prov][pi] ?? 0).toFixed(2)}
                  value={inputs[pi][provIdx]}
                  onChange={e => onChange(pi, provIdx, e.target.value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          {provinces.map(prov => {
            const { total, valid } = totals[prov];
            return (
              <td
                key={prov}
                className={`total-cell ${valid ? 'ok' : 'off'}`}
                title={valid ? undefined : 'Should add up to about 100%'}
              >
                {total.toFixed(1)}%
              </td>
            );
          })}
        </tr>
      </tfoot>
    </table>
  );
}
