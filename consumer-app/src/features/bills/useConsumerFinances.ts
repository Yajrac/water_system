import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
export type ConsumerBill = {
  id: string;
  number: string;
  month: string;
  due: string;
  previous: string;
  current: string;
  consumption: string;
  rate: string;
  water: string;
  connection: string;
  late: string;
  other: string;
  total: string;
  paid: string;
  balance: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
};
export type ConsumerPayment = {
  id: string;
  receipt: string;
  billId: string;
  month: string;
  amount: string;
  method: string;
  reference: string;
  date: string;
  previous: string;
  current: string;
  consumption: string;
  billNumber: string;
  balanceBefore: string;
  balanceAfter: string;
};
type Pagination = { page: number; limit: number; total: number };
export type ConsumerFinances = {
  summary: { balance: string; totalPaid: string; billCount: number; paymentCount: number };
  latestBill: ConsumerBill | null;
  bills: ConsumerBill[];
  payments: ConsumerPayment[];
  billsPagination: Pagination;
  paymentsPagination: Pagination;
};
export function useConsumerFinances(billsPage = 1, paymentsPage = 1) {
  const { accessToken } = useSession();
  const [data, setData] = useState<ConsumerFinances | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const current = ++version.current;
    if (!accessToken) {
      setData(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await consumerRequest<ConsumerFinances>(
        '/consumer/finances?billsPage=' + billsPage + '&paymentsPage=' + paymentsPage,
        undefined,
        accessToken,
        'GET',
      );
      if (current === version.current) setData(result);
    } catch (failure) {
      if (current === version.current) {
        setData(null);
        setError(failure instanceof Error ? failure.message : 'Could not load account records.');
      }
    } finally {
      if (current === version.current) setBusy(false);
    }
  }, [accessToken, billsPage, paymentsPage]);
  useFocusEffect(
    useCallback(() => {
      setData(null);
      void reload();
      return () => {
        version.current++;
      };
    }, [reload]),
  );
  return { data, error, busy, reload };
}
