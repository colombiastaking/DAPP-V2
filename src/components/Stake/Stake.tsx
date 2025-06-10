import React, { useEffect, useState } from 'react';
import { faLock, faGift, faPercent } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import classNames from 'classnames';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';

import { MultiversX } from 'assets/MultiversX';
import { network } from 'config';
import { useGlobalContext } from 'context';
import { denominated } from 'helpers/denominate';

import { Delegate } from './components/Delegate';
import { Undelegate } from './components/Undelegate';
import { StakeCols } from './components/StakeCols';
import { WithdrawCols } from './components/WithdrawCols';

import useStakeData from './hooks';
import { useColsAprContext } from '../../context/ColsAprContext';

import styles from './styles.module.scss';

const CLAIM_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const CLAIM_COLS_DATA = 'claimRewards@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';
const CLAIM_COLS_GAS_LIMIT = 10_000_000;

// Helper to denominate COLS (18 decimals)
function denominateCols(raw: string, addCommas = true) {
  if (!raw || raw === '0') return '0';
  let str = raw.padStart(19, '0');
  const intPart = str.slice(0, -18) || '0';
  let decPart = raw.length > 18 ? str.slice(-18).replace(/0+$/, '') : '';
  let result = decPart ? `${intPart}.${decPart}` : intPart;
  if (addCommas) {
    // Add thousands separator to int part
    const [i, d] = result.split('.');
    result = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  return result;
}

const ClaimCols = ({
  onClaimed
}: {
  onClaimed: () => void;
}) => {
  const { pending } = useGetActiveTransactionsStatus();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleClaimCols = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendTransactions({
        transactions: [
          {
            value: '0',
            data: CLAIM_COLS_DATA,
            receiver: CLAIM_COLS_CONTRACT,
            gasLimit: CLAIM_COLS_GAS_LIMIT
          }
        ]
      });
      setLoading(false);
      onClaimed();
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      style={{
        background: '#27C180',
        color: '#fff',
        fontWeight: 700,
        borderRadius: 7,
        padding: '15px 30px',
        border: 'none',
        marginRight: 0,
        marginBottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 16
      }}
      onClick={handleClaimCols}
      className={classNames(styles.action)}
      disabled={pending || loading}
    >
      <span role="img" aria-label="fire">🔥</span>
      Claim COLS
      <span role="img" aria-label="fire">🔥</span>
      {loading && (
        <span style={{ marginLeft: 8, fontSize: 14 }}>...</span>
      )}
      {error && (
        <span className={styles.error} style={{ marginLeft: 8 }}>{error}</span>
      )}
    </button>
  );
};

export const Stake = () => {
  const { pending } = useGetActiveTransactionsStatus();
  const { address } = useGetAccountInfo();
  const { userActiveStake, userClaimableRewards, stakedCols } = useGlobalContext();
  const { onRedelegate, onClaimRewards } = useStakeData();

  // Loading/Error/Empty state logic
  const isLoading =
    userActiveStake.status === 'loading' ||
    userClaimableRewards.status === 'loading';
  const isError =
    userActiveStake.status === 'error' ||
    userClaimableRewards.status === 'error';
  const isEmpty =
    userActiveStake.data === '0' && userClaimableRewards.data === '0';

  // --- Use live COLS APR data for user APR/ranking ---
  const { loading: aprLoading, stakers, baseApr } = useColsAprContext();
  const [userApr, setUserApr] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !Array.isArray(stakers) || stakers.length === 0) {
      setUserApr(null);
      setUserRank(null);
      return;
    }
    const idx = stakers.findIndex((s) => s.address === address);
    if (idx === -1) {
      setUserApr(null);
      setUserRank(null);
    } else {
      setUserApr(stakers[idx].aprTotal ?? null);
      setUserRank(stakers[idx].rank ?? null);
    }
  }, [address, stakers]);

  // Panels and UI
  return (
    <div
      className={classNames(
        styles.stake,
        { [styles.empty]: isLoading || isError || isEmpty },
        'stake'
      )}
    >
      {isLoading || isError || isEmpty ? (
        <div className={styles.wrapper}>
          <strong className={styles.heading}>
            Welcome to Colombia Staking Dashboard!
          </strong>

          <div className={styles.logo}>
            <MultiversX />

            <div style={{ background: '#2044F5' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faLock} />
            </div>
          </div>

          <div className={styles.message}>
            {isLoading
              ? 'Retrieving staking data...'
              : isError
              ? 'There was an error trying to retrieve staking data.'
              : `Currently you don't have any ${network.egldLabel} staked.`}
          </div>

          <Delegate />
          <StakeCols />
        </div>
      ) : (
        <div className={styles.assetsRow}>
          {/* Active Assets Panel */}
          <div className={styles.assetsBox}>
            <div className={styles.icon}>
              <MultiversX />
              <div style={{ background: '#2044F5' }} className={styles.subicon}>
                <FontAwesomeIcon icon={faLock} />
              </div>
            </div>
            <div className={styles.title}>Active Assets</div>
            <div className={styles.activeAmountsRow}>
              <span className={styles.activeAmount}>
                <b>
                  {denominated(userActiveStake.data || '...', { addCommas: true })} {network.egldLabel}
                </b>
                <div className={styles.activeLabel}>delegated</div>
              </span>
              <span className={styles.activeAmount}>
                <b>
                  {stakedCols.status === 'loaded'
                    ? denominateCols(stakedCols.data || '0', true)
                    : '...'} COLS
                </b>
                <div className={styles.activeLabel}>staked</div>
              </span>
            </div>
            <div className={styles.actionsRow}>
              <div className={styles.actionButtonWrapper}><Delegate /></div>
              <div className={styles.actionButtonWrapper}><StakeCols /></div>
              <div className={styles.actionButtonWrapper}><Undelegate /></div>
              <div className={styles.actionButtonWrapper}><WithdrawCols /></div>
            </div>
          </div>
          {/* APR Panel */}
          <div
            className={styles.assetsBox}
            style={{
              borderColor: '#ffb74d',
              background: 'linear-gradient(180deg, #ffb74d 0%, #ffe0b2 100%)',
              color: '#000',
              minWidth: 220
            }}
          >
            <div className={styles.icon} style={{ background: '#fff3e0' }}>
              <FontAwesomeIcon icon={faPercent} style={{ color: '#ff9800', fontSize: 32 }} />
            </div>
            <div className={styles.title} style={{ color: '#000' }}>APR for your eGLD</div>
            <div className={styles.aprInfo}>
              <div>
                <b>Base APR:</b>
                <span className={styles.aprValue} style={{ color: '#000', background: 'none' }}>
                  {aprLoading ? '...' : Number(baseApr).toFixed(2)}%
                </span>
              </div>
              <div>
                <b>Total APR with Bonus:</b>
                <span
                  className={styles.aprValue}
                  style={{
                    color: '#b71c1c',
                    fontWeight: 700,
                    background: 'none'
                  }}
                >
                  <span style={{
                    color: '#b71c1c',
                    background: 'none',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: 0.5,
                    display: 'inline-block'
                  }}>
                    {aprLoading
                      ? '...'
                      : userApr !== null
                        ? Number(userApr).toFixed(2)
                        : Number(baseApr).toFixed(2)
                    }%
                  </span>
                </span>
              </div>
              <div>
                <b>Your Ranking:</b>
                <span className={styles.aprValue} style={{ color: '#000', background: 'none' }}>
                  {aprLoading
                    ? '...'
                    : userRank !== null
                      ? `#${userRank} of ${stakers.length} COLS stakers`
                      : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Claim Rewards Panel */}
      {!isLoading && !isError && !isEmpty && (
        <div className={styles.panel}>
          <div className={styles.icon}>
            <MultiversX />
            <div style={{ background: '#27C180' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faGift} />
            </div>
          </div>
          <div className={styles.title}>Claim Rewards</div>
          <div className={styles.actions}>
            <button
              type="button"
              style={{
                background: '#27C180',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 7,
                padding: '15px 30px',
                border: 'none'
              }}
              className={classNames(styles.action)}
              disabled={pending}
              onClick={onClaimRewards(() => false)}
            >
              Claim eGLD Now
            </button>
            <button
              type="button"
              style={{
                background: '#27C180',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 7,
                padding: '15px 30px',
                border: 'none'
              }}
              className={classNames(styles.action)}
              disabled={pending}
              onClick={onRedelegate(() => false)}
            >
              Redelegate eGLD
            </button>
            <ClaimCols onClaimed={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
};
