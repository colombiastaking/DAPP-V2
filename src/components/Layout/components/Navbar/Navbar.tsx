import { ReactNode, useEffect, useState } from 'react';

import { faWallet, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { logout } from '@multiversx/sdk-dapp/utils/logout';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import axios from 'axios';

import { MultiversX } from 'assets/MultiversX';
import { network } from 'config';
import { denominated } from 'helpers/denominate';

import styles from './styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';

export const Navbar = () => {
  const { address, account } = useGetAccountInfo();
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCols = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${network.apiAddress}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
        );
        if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
          // 18 decimals
          let raw = data[0].balance.padStart(19, '0');
          const intPart = raw.slice(0, -18) || '0';
          let decPart = raw.slice(-18).replace(/0+$/, '');
          setColsBalance(decPart ? `${intPart}.${decPart}` : intPart);
        } else {
          setColsBalance('0');
        }
      } catch {
        setColsBalance('0');
      }
      setLoading(false);
    };
    if (address) fetchCols();
  }, [address]);

  const buttons: { icon: ReactNode; label: string; onClick?: () => void }[] = [
    {
      icon: <MultiversX />,
      label: `${denominated(account.balance)} ${network.egldLabel}`
    },
    {
      icon: <span role="img" aria-label="fire" style={{ fontSize: 18, marginRight: 4 }}>🔥</span>,
      label: `${loading ? '...' : colsBalance} COLS`
    },
    {
      icon: <FontAwesomeIcon icon={faWallet} size='lg' />,
      label: address,
      onClick: () => navigator.clipboard.writeText(address)
    },
    {
      icon: <FontAwesomeIcon icon={faPowerOff} />,
      label: 'Disconnect',
      onClick: () => logout(`${location.origin}/unlock`)
    }
  ];

  return (
    <nav className={`${styles.nav} delegation-nav`}>
      <Link to='/dashboard' className={styles.heading}>
        <span className={styles.logo}>
          <MultiversX />
        </span>
        <span className={styles.title}>Colombia Staking Dashboard</span>
      </Link>
      <div className={styles.buttons}>
        {buttons.map((button, idx) => (
          <div
            key={button.label + idx}
            onClick={button.onClick}
            className={classNames(styles.button, {
              [styles.clickable]: Boolean(button.onClick)
            })}
          >
            <div className={styles.icon}>{button.icon}</div>
            <span>{button.label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
};
