import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { useConsumerFinances, type ConsumerBill } from './useConsumerFinances';
import { money } from '@/theme/tokens';

export default function BillsScreen() {
  const [page, setPage] = useState(1);
  const { data, error, busy, reload } = useConsumerFinances(page);
  const bills = data?.bills || [];
  const [selected, setSelected] = useState<ConsumerBill | null>(null);
  return (
    <Screen title="My bills">
      <Text style={text.muted}>Your monthly statements and meter readings.</Text>
      <Button
        label={busy ? 'Loading...' : 'Refresh bills'}
        disabled={busy}
        onPress={() => void reload()}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={text.muted}>
          {error}
        </Text>
      )}
      {!busy && !error && !bills.length && <Text style={text.muted}>No bills yet.</Text>}
      {bills.map((bill) => (
        <RecordCard
          key={bill.id}
          title={bill.month}
          amount={money(Number(bill.total))}
          details={bill.consumption + ' m\u00b3 - Due ' + bill.due}
          status={bill.status}
          paid={bill.status === 'Paid'}
          icon="bills"
          action="View bill"
          onPress={() => setSelected(bill)}
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
            disabled={busy || page * data.billsPagination.limit >= data.billsPagination.total}
            onPress={() => setPage(page + 1)}
          />
        </>
      )}
      <Sheet
        title={selected?.month || 'Bill details'}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <Detail label="Previous reading" value={selected.previous + ' m³'} />
            <Detail label="Current reading" value={selected.current + ' m³'} />
            <Detail label="Water consumed" value={selected.consumption + ' m³'} />
            <Detail label="Rate / m³" value={money(Number(selected.rate))} />
            <Detail label="Water charge" value={money(Number(selected.water))} />
            <Detail label="Connection charge" value={money(Number(selected.connection))} />
            <Detail label="Late fee" value={money(Number(selected.late))} />
            <Detail label="Other charges" value={money(Number(selected.other))} />
            <Detail label="Bill total" value={money(Number(selected.total))} />
            <Detail label="Paid" value={money(Number(selected.paid))} />
            <Detail label="Remaining balance" value={money(Number(selected.balance))} />
            <Text style={text.muted}>
              Please settle payments at the PWSS office and keep your receipt.
            </Text>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
