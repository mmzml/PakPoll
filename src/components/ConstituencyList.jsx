import { useState, useMemo } from 'react';
import { partyTextStyle } from '../utils/partyText';

export default function ConstituencyList({ data, onSelect }) {
  const [changedOnly, setChangedOnly] = useState(false);

  const changed = useMemo(() => data.filter(c => c.prevWinner !== c.currWinner), [data]);

  // Count of seats moving between each pair of parties, largest first
  const flows = useMemo(() => {
    const counts = new Map();
    changed.forEach(c => {
      const key = `${c.prevWinner}→${c.currWinner}`;
      const flow = counts.get(key) ?? { from: c.prevWinner, fromColor: c.prevWinnerColor, to: c.currWinner, toColor: c.currWinnerColor, count: 0 };
      flow.count += 1;
      counts.set(key, flow);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [changed]);

  // Before a map is generated, data is the 2024 result: no projection, so no filter
  const isBaseline = data[0]?.isBaseline;
  const rows = changedOnly && !isBaseline ? changed : data;

  return (
    <>
      {isBaseline ? (
        <div className="const-filter const-baseline-note">
          Showing 2024 results. Generate a map to see projections and seats changing hands.
        </div>
      ) : (
        <div className="const-filter">
          <div className="const-filter-buttons" role="group" aria-label="Filter constituencies">
            <button
              className={`const-filter-btn${!changedOnly ? ' active' : ''}`}
              aria-pressed={!changedOnly}
              onClick={() => setChangedOnly(false)}
            >
              All seats ({data.length})
            </button>
            <button
              className={`const-filter-btn${changedOnly ? ' active' : ''}`}
              aria-pressed={changedOnly}
              onClick={() => setChangedOnly(true)}
            >
              Changing hands ({changed.length})
            </button>
          </div>
          {changedOnly && flows.length > 0 && (
            <div className="const-flows">
              {flows.map(f => (
                <span key={`${f.from}→${f.to}`} className="const-flow">
                  <span style={partyTextStyle(f.fromColor)}>{f.from}</span>
                  {' → '}
                  <span style={partyTextStyle(f.toColor)}>{f.to}</span>
                  <span className="const-flow-count">{f.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="const-list-wrap">
        {rows.length === 0 ? (
          <div className="const-list-none">No seats change hands in this projection.</div>
        ) : (
          <table className="const-list-table">
            <thead>
              <tr>
                <th>Const.</th>
                <th>Province</th>
                {isBaseline ? (
                  <>
                    <th>2024 Winner</th>
                    <th>Top 5 Parties — 2024 Vote %</th>
                  </>
                ) : (
                  <>
                    <th>Prev. Winner</th>
                    <th>Proj. Winner</th>
                    <th>Top 5 Parties — Vote % (Swing)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                // Whole row is clickable; the ID button makes it reachable by keyboard too
                <tr key={c.id} className="const-row" onClick={() => onSelect(c.id)} title="Show on map">
                  <td className="const-id">
                    <button type="button" className="const-id-link">{c.id}</button>
                  </td>
                  <td>{c.province}</td>
                  <td>
                    <span style={partyTextStyle(c.prevWinnerColor)}>
                      {c.prevWinner}
                    </span>
                  </td>
                  {!isBaseline && (
                    <td>
                      <span style={partyTextStyle(c.currWinnerColor)}>
                        {c.currWinner}
                      </span>
                    </td>
                  )}
                  <td>
                    <div className="const-party-list">
                      {c.partyData.map(p => (
                        <div key={p.name} className="const-party-row">
                          <span className="const-party-dot" style={{ background: `#${p.color}` }} />
                          <span className="const-party-name">{p.name}</span>
                          <span className="const-party-pct">{p.newPct.toFixed(1)}%</span>
                          {!isBaseline && (
                            <span className={`const-party-swing ${p.swing > 0 ? 'swing-pos' : p.swing < 0 ? 'swing-neg' : 'swing-zero'}`}>
                              {p.swing > 0 ? '+' : ''}{p.swing.toFixed(1)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
