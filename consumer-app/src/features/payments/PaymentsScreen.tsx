import { useConsumerHistory } from '@/features/bills/useConsumerHistory';
import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { type ConsumerPayment } from '../bills/useConsumerFinances';
import { useConsumerProfile } from '../profile/useConsumerProfile';
import { colors, money } from '@/theme/tokens';

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
            <View style={styles.receipt}>
              <View style={styles.check}><Text style={styles.checkMark}>{'✓'}</Text></View>
              <Text style={styles.receiptTitle}>Payment received</Text>
              <Text style={styles.receiptAmount}>{money(Number(selected.amount))}</Text>
              <Text style={text.muted}>PIO DURAN WATER SUPPLY</Text>
            </View>
            <Detail label="Receipt number" value={selected.receipt} />
            <Detail label="Customer" value={customer?.name || 'Loading...'} />
            <Detail label="Date paid" value={selected.date} />
            <Detail label="Billing month" value={selected.month} />
            <Detail label="Previous reading" value={selected.previous + ' m³'} />
            <Detail label="Current reading" value={selected.current + ' m³'} />
            <Detail label="Water consumed" value={selected.consumption + ' m³'} />
            <Detail label="Amount paid" value={money(Number(selected.amount))} strong />
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

const styles = StyleSheet.create({
  receipt: { alignItems: 'center', gap: 6, padding: 18, borderRadius: 18, backgroundColor: colors.successTint },
  check: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  checkMark: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  receiptTitle: { fontSize: 13, fontWeight: '700', color: colors.success },
  receiptAmount: { fontSize: 30, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});
