import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { useConsumerFinances, type ConsumerPayment } from '../bills/useConsumerFinances';
import { useConsumerProfile } from '../profile/useConsumerProfile';
import { money } from '@/theme/tokens';

export default function PaymentsScreen() {
  const [page, setPage] = useState(1);
  const { data, error, busy, reload } = useConsumerFinances(1, page);
  const { profile: customer } = useConsumerProfile();
  const payments = data?.payments || [];
  const [selected, setSelected] = useState<ConsumerPayment | null>(null);
  return (
    <Screen title="Payment history">
      <RefreshControl busy={busy} onRefresh={() => void reload()} />
      {busy && !data && <LoadingCards />}
      {!!error && (
        <Text accessibilityRole="alert" style={text.muted}>
          {error}
        </Text>
      )}
      {!busy && !error && !payments.length && (
        <Text style={text.muted}>No payments recorded yet.</Text>
      )}
      {payments.map((payment) => (
        <RecordCard
          key={payment.receipt}
          title={payment.month}
          amount={money(Number(payment.amount))}
          details={payment.date + ' - ' + payment.method}
          status="Recorded"
          paid
          icon="payments"
          action="View receipt"
          onPress={() => setSelected(payment)}
        />
      ))}
      {!!data && (
        <>
          <Text style={text.muted}>Page {page}</Text>
          <Button
            label="Previous"
            secondary
            disabled={busy || page === 1}
            onPress={() => setPage(page - 1)}
          />
          <Button
            label="Next"
            secondary
            disabled={busy || page * data.paymentsPagination.limit >= data.paymentsPagination.total}
            onPress={() => setPage(page + 1)}
          />
        </>
      )}
      <Sheet title="Payment receipt" visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text style={text.heading}>PIO DURAN WATER SUPPLY</Text>
            <Detail label="Receipt number" value={selected.receipt} />
            <Detail label="Customer" value={customer?.name || 'Loading...'} />
            <Detail label="Date paid" value={selected.date} />
            <Detail label="Billing month" value={selected.month} />
            <Detail label="Previous reading" value={selected.previous + ' m³'} />
            <Detail label="Current reading" value={selected.current + ' m³'} />
            <Detail label="Water consumed" value={selected.consumption + ' m³'} />
            <Detail label="Amount paid" value={money(Number(selected.amount))} />
            <Detail label="Payment method" value={selected.method} />
            {!!selected.reference && <Detail label="Reference" value={selected.reference} />}
            <Detail label="Balance before payment" value={money(Number(selected.balanceBefore))} />
            <Detail label="Balance after payment" value={money(Number(selected.balanceAfter))} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
