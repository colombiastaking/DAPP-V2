import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import classNames from 'classnames';
import { useState } from 'react';

import styles from '../Undelegate/styles.module.scss';

const WITHDRAW_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const GAS_LIMIT = 10_000_000;
const RAW_DATA = 'withdraw@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';

export const WithdrawCols = () => {
  const { pending } = useGetActiveTransactionsStatus();
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    setError(null);
    try {
      await sendTransactions({
        transactions: [
          {
            value: '0',
            data: RAW_DATA,
            receiver: WITHDRAW_CONTRACT,
            gasLimit: GAS_LIMIT
          }
        ]
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
    }
  };

  return (
    <div className={classNames(styles.wrapper, 'undelegate-wrapper')}>
      <button
        type="button"
        className={classNames(styles.trigger, {
          [styles.disabled]: pending
        })}
        onClick={handleWithdraw}
        disabled={pending}
      >
        Withdraw COLS
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};
