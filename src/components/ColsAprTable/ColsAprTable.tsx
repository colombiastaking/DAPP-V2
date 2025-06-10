import { useColsAprContext } from '../../context/ColsAprContext';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import type { ColsStakerRow } from '../../hooks/useColsApr';

const TARGET_USER = 'erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm';

export function ColsAprTable() {
  const { address } = useGetAccountInfo();
  const { loading, stakers, egldPrice, colsPrice } = useColsAprContext();

  // Only show table if the logged-in user is the target user
  if (address !== TARGET_USER) return null;
  if (loading) return <div>Loading COLS-DIST table...</div>;

  // Include all addresses with COLS staked and eGLD delegated
  const filtered = stakers.filter(
    (row: ColsStakerRow) => row.colsStaked > 0 && row.egldStaked > 0
  );

  // Calculate COLS-DIST(i) for each eligible user
  const rows = filtered.map((row: ColsStakerRow) => {
    // COLS-DIST(i) = APR-BONUS(i)/100 * eGLD-staked(i) * eGLDprice / 365 / COLSprice
    const colsDist =
      row.aprBonus && row.egldStaked && egldPrice && colsPrice
        ? (row.aprBonus / 100) * row.egldStaked * egldPrice / 365 / colsPrice
        : 0;
    return {
      address: row.address,
      colsDist
    };
  });

  if (rows.length === 0) {
    return <div>No eligible data for COLS-DIST table.</div>;
  }

  // Render as a copy-paste ready table (plain text, tab-separated, no header)
  return (
    <div style={{ margin: 16 }}>
      <h3>COLS-DIST Table</h3>
      <pre style={{
        background: '#222',
        color: '#fff',
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
        userSelect: 'all'
      }}>
{rows.map((r: { address: string; colsDist: number }) =>
  `${r.address}\t${r.colsDist.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
).join('\n')}
      </pre>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        <b>eGLD Price:</b> ${egldPrice} &nbsp; <b>COLS Price:</b> ${colsPrice}
      </div>
    </div>
  );
}
