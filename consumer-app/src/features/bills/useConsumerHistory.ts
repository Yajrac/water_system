import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { consumerRequest } from '../session/api';
import { useSession } from '../session/SessionProvider';
import type { ConsumerBill, ConsumerFinances, ConsumerPayment } from './useConsumerFinances';

type HistoryKind = 'bills' | 'payments';
type RecordFor<K extends HistoryKind> = K extends 'bills' ? ConsumerBill : ConsumerPayment;

export function useConsumerHistory<K extends HistoryKind>(kind: K) {
  const { accessToken } = useSession();
  const [items, setItems] = useState<RecordFor<K>[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const pages = useRef(1);
  const records = useRef<RecordFor<K>[]>([]);
  const version = useRef(0);
  const pending = useRef(false);
  const load = useCallback(async (more: boolean) => {
    if (!accessToken || (more && pending.current)) return;
    const current = ++version.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const last = more ? pages.current + 1 : pages.current;
      const pageNumbers = more ? [last] : Array.from({ length: last }, (_, index) => index + 1);
      const results = await Promise.all(pageNumbers.map(page =>
        consumerRequest<ConsumerFinances>('/consumer/finances?' + (kind === 'bills' ? 'billsPage=' : 'paymentsPage=') + page, undefined, accessToken, 'GET')));
      if (current !== version.current) return;
      const incoming = results.flatMap<RecordFor<K>>(result => result[kind] as RecordFor<K>[]);
      const combined = more ? [...records.current, ...incoming] : incoming;
      const unique = [...new Map(combined.map(item => [String(item.id), item])).values()];
      records.current = unique;
      pages.current = last;
      setItems(unique);
      setTotal(results[0][kind === 'bills' ? 'billsPagination' : 'paymentsPagination'].total);
      setLoaded(true);
    } catch (failure) {
      if (current === version.current) setError(failure instanceof Error ? failure.message : 'Could not load records.');
    } finally {
      if (current === version.current) { pending.current = false; setBusy(false); }
    }
  }, [accessToken, kind]);
  useFocusEffect(useCallback(() => {
    void load(false);
    return () => { version.current++; pending.current = false; };
  }, [load]));
  return { items, loaded, busy, error, hasMore: items.length < total, reload: () => load(false), seeMore: () => load(true) };
}
