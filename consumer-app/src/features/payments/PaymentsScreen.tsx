import { useConsumerHistory } from '@/features/bills/useConsumerHistory';
import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { type ConsumerPayment } from '../bills/useConsumerFinances';
import { useConsumerProfile } from '../profile/useConsumerProfile';
import { money } from '@/theme/tokens';

export default function PaymentsScreen() {
  const { items: payments, loaded, error, busy, reload, seeMore, hasMore } = useConsumerHistory('payments');
  const { profile: customer } = useConsumerProfile();
  const [selected, setSelected] = useState<ConsumerPayment | null>(null);
  return (
    <Screen title="Payment history">
      <RefreshControl busy={busy} onRefresh={() => void reload()} />
      {busy && !loaded && <LoadingCards />}
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
      {hasMore && <Button label={busy ? 'Loading...' : 'See more'} secondary disabled={busy} onPress={() => void seeMore()} />}
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
