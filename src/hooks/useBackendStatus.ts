import { useState, useEffect, useCallback } from 'react';
import { checkBackendAvailable, resetBackendCheck } from '../api/backend';

/**
 * Hook that tracks backend availability.
 * Checks on mount and re-checks when the tab regains focus.
 */
export function useBackendStatus() {
  const [isAvailable, setIsAvailable] = useState(false);

  const check = useCallback(async () => {
    const available = await checkBackendAvailable();
    setIsAvailable(available);
  }, []);

  useEffect(() => {
    check();

    const handleFocus = () => {
      resetBackendCheck();
      check();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [check]);

  return { isAvailable, recheck: check };
}
