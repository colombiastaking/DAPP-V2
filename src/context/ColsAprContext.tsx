import { createContext, useContext, useState, useCallback } from 'react';
import { useColsApr } from '../hooks/useColsApr';

const ColsAprContext = createContext<any>(null);

export function ColsAprProvider({ children }: { children: any }) {
  const [trigger, setTrigger] = useState(0);
  const { loading, stakers, egldPrice, colsPrice, baseApr } = useColsApr({ trigger });

  // Call this after user action to force recalc
  const refresh = useCallback(() => setTrigger(t => t + 1), []);

  return (
    <ColsAprContext.Provider value={{
      loading, stakers, egldPrice, colsPrice, baseApr, refresh
    }}>
      {children}
    </ColsAprContext.Provider>
  );
}

export function useColsAprContext() {
  return useContext(ColsAprContext);
}
