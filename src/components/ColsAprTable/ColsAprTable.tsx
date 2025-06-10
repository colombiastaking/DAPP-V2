import { useColsAprContext } from '../../context/ColsAprContext';
import type { ColsStakerRow } from '../../hooks/useColsApr';

export function ColsAprTable() {
  const { loading, stakers, egldPrice, colsPrice, baseApr } = useColsAprContext();

  if (loading) return <div>Loading COLS APR table...</div>;
  return (
    <div style={{ overflowX: 'auto', margin: 16 }}>
      <h3>COLS Stakers APR Table</h3>
      <table style={{ minWidth: 900, background: '#222', color: '#fff', borderRadius: 8 }}>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Address</th>
            <th>COLS Staked</th>
            <th>eGLD Staked</th>
            <th>Ratio</th>
            <th>Normalized</th>
            <th>APR Bonus</th>
            <th>DAO</th>
            <th>APR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {stakers.map((row: ColsStakerRow) => (
            <tr key={row.address}>
              <td>{row.rank}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{row.address}</td>
              <td>{row.colsStaked.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
              <td>{row.egldStaked.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
              <td>{row.ratio !== null ? row.ratio.toFixed(4) : '-'}</td>
              <td>{row.normalized !== null ? row.normalized.toFixed(4) : '-'}</td>
              <td>{row.aprBonus !== null ? row.aprBonus.toFixed(4) : '-'}</td>
              <td>{row.dao !== null ? row.dao.toFixed(4) : '-'}</td>
              <td>{row.aprTotal !== null ? row.aprTotal.toFixed(4) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        <b>eGLD Price:</b> ${egldPrice} &nbsp; <b>COLS Price:</b> ${colsPrice} &nbsp; <b>Base APR:</b> {baseApr}%
      </div>
    </div>
  );
}
