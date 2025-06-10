import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Address,
  Query,
  ContractFunction,
  AddressValue,
  decodeBigNumber
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { network } from 'config';
import { useGlobalContext } from 'context';

const PEERME_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const PEERME_ENTITY_ADDRESS = 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';

const APRmin = 1.11;
const APRmax = 3;

// --- CONSTANTS ---
const RAW_APR = 7.09; // Raw APR before service fee (used for DAO bonus, not base APR)
const AGENCY_BUYBACK = 0.3; // Agency buyback percentage
const DAO_DISTRIBUTION_RATIO = 0.333; // Portion of buybacks distributed to DAO

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

// Fetch latest COLS price from MultiversX API
async function fetchColsPriceFromApi() {
  try {
    const { data } = await axios.get(
      'https://api.multiversx.com/mex/tokens/prices/daily/COLS-9d91b7'
    );
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      if (last && typeof last.value === 'number') {
        // Round to 3 decimal places
        return Math.round(last.value * 1000) / 1000;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

// Fetch base APR from MultiversX API for the staking contract
async function fetchBaseAprFromApi() {
  try {
    const { data } = await axios.get(
      `https://api.multiversx.com/providers/${network.delegationContract}`
    );
    if (data && typeof data.apr === 'number') {
      return data.apr;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function useColsApr({ trigger }: { trigger: any }) {
  const [loading, setLoading] = useState(true);
  const [stakers, setStakers] = useState<ColsStakerRow[]>([]);
  const [egldPrice, setEgldPrice] = useState<number>(0);
  const [colsPrice, setColsPrice] = useState<number>(0);
  const [baseApr, setBaseApr] = useState<number>(0);

  // Get agency service fee from global context
  const { contractDetails } = useGlobalContext();

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

  // 4. Main calculation
  const recalc = useCallback(async () => {
    setLoading(true);
    // 1. COLS stakers
    const colsStakers = await fetchColsStakers();
    // 2. eGLD staked
    const egldStakedMap = await fetchEgldStaked(colsStakers.map(s => s.address));
    // 3. Prices
    const egldPrice = await fetchEgldPrice();
    setEgldPrice(egldPrice);

    // 4. Fetch COLS price from MultiversX API
    const fetchedColsPrice = await fetchColsPriceFromApi();
    setColsPrice(fetchedColsPrice);

    // 5. Fetch base APR from MultiversX API
    const fetchedBaseApr = await fetchBaseAprFromApi();
    setBaseApr(fetchedBaseApr);

    // 6. Parse agency service fee (e.g. "10%" -> 0.1)
    let agencyServiceFee = 0.1; // fallback
    if (
      contractDetails &&
      contractDetails.data &&
      typeof contractDetails.data.serviceFee === 'string'
    ) {
      const feeStr = contractDetails.data.serviceFee.replace('%', '').trim();
      const feeNum = parseFloat(feeStr);
      if (!isNaN(feeNum)) {
        agencyServiceFee = feeNum / 100;
      }
    }

    // 7. Build table
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

    // 8. Calculate ratios
    for (const row of table) {
      if (row.egldStaked > 0 && fetchedColsPrice > 0 && egldPrice > 0) {
        row.ratio = (row.colsStaked * fetchedColsPrice) / (row.egldStaked * egldPrice);
      } else {
        row.ratio = null;
      }
    }
    // 9. Normalize
    const validRatios = table.filter(r => r.ratio !== null).map(r => r.ratio!);
    const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
    const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;
    for (const row of table) {
      if (row.ratio !== null && maxRatio !== minRatio) {
        row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
      } else {
        row.normalized = null;
      }
    }
    // 10. APR(i)
    for (const row of table) {
      if (row.normalized !== null) {
        row.aprBonus = APRmin + (APRmax - APRmin) * Math.sqrt(row.normalized);
      } else {
        row.aprBonus = null;
      }
    }
    // 11. DAO(i) - Only for users with active eGLD staked
    const totalEgldStaked = table.reduce((sum, r) => sum + (r.egldStaked || 0), 0);
    const sumColsStaked = table.reduce((sum, r) => sum + (r.colsStaked || 0), 0);
    for (const row of table) {
      if (row.egldStaked > 0 && row.colsStaked > 0 && sumColsStaked > 0) {
        // DAO(i) = Total-eGLD * RAW-APR * serviceFee * Agency-Buy-back * DAO_DISTRIBUTION_RATIO * COLS-staked(i) ÷ SUM(COLS-staked(i)) ÷ eGLD-staked(i)
        const dao = (
          totalEgldStaked *
          RAW_APR *
          agencyServiceFee *
          AGENCY_BUYBACK *
          DAO_DISTRIBUTION_RATIO *
          row.colsStaked /
          sumColsStaked /
          row.egldStaked
        );
        row.dao = dao;
      } else {
        row.dao = null;
      }
    }
    // 12. APR_TOTAL: Only for users with active eGLD staked, otherwise just base APR
    for (const row of table) {
      if (row.egldStaked > 0) {
        row.aprTotal = fetchedBaseApr + (row.aprBonus || 0) + (row.dao || 0);
      } else {
        row.aprTotal = fetchedBaseApr;
      }
    }
    // 13. Ranking
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
  }, [fetchColsStakers, fetchEgldStaked, fetchEgldPrice, contractDetails]);

  // Recalculate on login, trigger, or user actions
  useEffect(() => {
    recalc();
    // eslint-disable-next-line
  }, [trigger, contractDetails]);

  return { loading, stakers, egldPrice, colsPrice, baseApr, recalc };
}
