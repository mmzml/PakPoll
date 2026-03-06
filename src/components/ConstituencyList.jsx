export default function ConstituencyList({ data }) {
  if (!data) {
    return (
      <div className="const-list-empty">
        Generate the map to view constituency data.
      </div>
    );
  }

  return (
    <div className="const-list-wrap">
      <table className="const-list-table">
        <thead>
          <tr>
            <th>Const.</th>
            <th>Province</th>
            <th>Prev. Winner</th>
            <th>Proj. Winner</th>
            <th>Top 5 Parties — Vote % (Swing)</th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id}>
              <td className="const-id">{c.id}</td>
              <td>{c.province}</td>
              <td>
                <span style={{ color: `#${c.prevWinnerColor}`, fontWeight: 'bold' }}>
                  {c.prevWinner}
                </span>
              </td>
              <td>
                <span style={{ color: `#${c.currWinnerColor}`, fontWeight: 'bold' }}>
                  {c.currWinner}
                </span>
              </td>
              <td>
                <div className="const-party-list">
                  {c.partyData.map(p => (
                    <div key={p.name} className="const-party-row">
                      <span className="const-party-dot" style={{ background: `#${p.color}` }} />
                      <span className="const-party-name">{p.name}</span>
                      <span className="const-party-pct">{p.newPct.toFixed(1)}%</span>
                      <span className={`const-party-swing ${p.swing > 0 ? 'swing-pos' : p.swing < 0 ? 'swing-neg' : 'swing-zero'}`}>
                        {p.swing > 0 ? '+' : ''}{p.swing.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
