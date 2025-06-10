import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Address, Query, ContractFunction, AddressValue, decodeBigNumber } from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { network } from 'config';

const PEERME_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const PEERME_ENTITY_ADDRESS = 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';

const APRmin = 1.11;
const APRmax = 3;

// Use a constant COLS price (in USD)
const COLS_PRICE_USD = 0.12;

export interface ColsStakerRow {
  address: string;
  colsStaked: number;
  egldStaked: number;
  ratio: number | null;
  normalized: number | null;
  aprBonus: number | null;
  dao: number | null;
  aprTotal: number | null;
  rank: number | null;
}

export function useColsApr({ trigger }: { trigger: any }) {
  const [loading, setLoading] = useState(true);
  const [stakers, setStakers] = useState<ColsStakerRow[]>([]);
  const [egldPrice, setEgldPrice] = useState<number>(0);
  const [colsPrice] = useState<number>(COLS_PRICE_USD);
  const [baseApr, setBaseApr] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0.1); // fallback 10%

  // 1. Fetch COLS stakers and balances
  const fetchColsStakers = useCallback(async () => {
    const provider = new ProxyNetworkProvider(network.gatewayAddress);
    const query = new Query({
      address: new Address(PEERME_COLS_CONTRACT),
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(new Address(PEERME_ENTITY_ADDRESS))]
    });
    const data = await provider.queryContract(query);
    const parts = data.getReturnDataParts();
    const result: { address: string; colsStaked: number }[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const addr = new Address(parts[i]).bech32();
      const amt = decodeBigNumber(parts[i + 1]).toFixed();
      result.push({ address: addr, colsStaked: Number(amt) / 1e18 });
    }
    return result;
  }, []);

  // 2. Fetch eGLD delegated for each COLS staker
  const fetchEgldStaked = useCallback(async (addresses: string[]) => {
    const provider = new ProxyNetworkProvider(network.gatewayAddress);
    // batch queries for performance
    const results: Record<string, number> = {};
    for (const addr of addresses) {
      try {
        const query = new Query({
          address: new Address(network.delegationContract),
          func: new ContractFunction('getUserActiveStake'),
          args: [new AddressValue(new Address(addr))]
        });
        const data = await provider.queryContract(query);
        const [stake] = data.getReturnDataParts();
        results[addr] = stake ? Number(decodeBigNumber(stake).toFixed()) / 1e18 : 0;
      } catch {
        results[addr] = 0;
      }
    }
    return results;
  }, []);

  // 3. Fetch eGLD price only
  const fetchEgldPrice = useCallback(async () => {
    // Use MultiversX economics endpoint (USD)
    try {
      const { data } = await axios.get(`${network.apiAddress}/economics`);
      return Number(data.price);
    } catch {
      return 0;
    }
  }, []);

  // 4. Fetch base APR and service fee
  const fetchBaseApr = useCallback(async () => {
    // Try to get from contract, fallback to 7.056
    try {
      const provider = new ProxyNetworkProvider(network.gatewayAddress);
      const query = new Query({
        address: new Address(network.delegationContract),
        func: new ContractFunction('getContractConfig')
      });
      const data = await provider.queryContract(query);
      const response = data.getReturnDataParts();
      // serviceFee is index 1, as per codebase
      const serviceFee = Number(response[1]?.readBigUInt64BE?.() ?? 1000) / 10000; // fallback 10%
      // base APR: fallback to 7.056
      return { baseApr: 7.056, serviceFee };
    } catch {
      return { baseApr: 7.056, serviceFee: 0.1 };
    }
  }, []);

  // 5. Main calculation
  const recalc = useCallback(async () => {
    setLoading(true);
    // 1. COLS stakers
    const colsStakers = await fetchColsStakers();
    // 2. eGLD staked
    const egldStakedMap = await fetchEgldStaked(colsStakers.map(s => s.address));
    // 3. Prices
    const egldPrice = await fetchEgldPrice();
    setEgldPrice(egldPrice);
    // 4. Base APR and service fee
    const { baseApr, serviceFee } = await fetchBaseApr();
    setBaseApr(baseApr * (1 - serviceFee));
    setServiceFee(serviceFee);

    // 5. Build table
    const table: ColsStakerRow[] = colsStakers.map(s => ({
      address: s.address,
      colsStaked: s.colsStaked,
      egldStaked: egldStakedMap[s.address] || 0,
      ratio: null,
      normalized: null,
      aprBonus: null,
      dao: null,
      aprTotal: null,
      rank: null
    }));

    // 6. Calculate ratios
    for (const row of table) {
      if (row.egldStaked > 0) {
        row.ratio = (row.colsStaked * COLS_PRICE_USD) / (row.egldStaked * egldPrice);
      } else {
        row.ratio = null;
      }
    }
    // 7. Normalize
    const validRatios = table.filter(r => r.ratio !== null).map(r => r.ratio!);
    const minRatio = Math.min(...validRatios);
    const maxRatio = Math.max(...validRatios);
    for (const row of table) {
      if (row.ratio !== null && maxRatio !== minRatio) {
        row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
      } else {
        row.normalized = null;
      }
    }
    // 8. APR(i)
    for (const row of table) {
      if (row.normalized !== null) {
        row.aprBonus = APRmin + (APRmax - APRmin) * Math.sqrt(row.normalized);
      } else {
        row.aprBonus = null;
      }
    }
    // 9. DAO(i)
    const totalEgldStaked = table.reduce((sum, r) => sum + (r.egldStaked || 0), 0);
    const sumColsStaked = table.reduce((sum, r) => sum + (r.colsStaked || 0), 0);
    for (const row of table) {
      if (row.egldStaked > 0 && sumColsStaked > 0) {
        // DAO(i) formula
        // DAO(i)=(Totale-GLD-staked×APR-pool*0,1*0,3*0,3333*eGLDprice*COLSprice*eGLD-staked-i÷SUM(COLS-staked(i))*COLSprice÷eGLDprice)÷eGLD-staked(i)*100
        // Let's break it down:
        // pool = totalEgldStaked
        // baseApr = baseApr
        // egldStaked = row.egldStaked
        // sumColsStaked = sumColsStaked
        // colsStaked = row.colsStaked
        // egldPrice, COLS_PRICE_USD
        const part1 = totalEgldStaked * baseApr * 0.1 * 0.3 * 0.3333 * egldPrice * COLS_PRICE_USD;
        const part2 = (row.egldStaked / sumColsStaked) * COLS_PRICE_USD / egldPrice;
        const dao = (part1 * part2) / row.egldStaked * 100;
        row.dao = dao;
      } else {
        row.dao = null;
      }
    }
    // 10. APR_TOTAL
    for (const row of table) {
      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
    }
    // 11. Ranking
    const sorted = [...table].sort((a, b) => (b.aprTotal || 0) - (a.aprTotal || 0));
    for (let i = 0; i < sorted.length; ++i) {
      sorted[i].rank = i + 1;
    }
    // assign ranks back
    for (const row of table) {
      const found = sorted.find(r => r.address === row.address);
      row.rank = found ? found.rank : null;
    }
    setStakers(table);
    setLoading(false);
  }, [fetchColsStakers, fetchEgldStaked, fetchEgldPrice, fetchBaseApr]);

  // Recalculate on login, trigger, or user actions
  useEffect(() => {
    recalc();
    // eslint-disable-next-line
  }, [trigger]);

  return { loading, stakers, egldPrice, colsPrice, baseApr, serviceFee, recalc };
}
