import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { Text } from 'react-native';
import { Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { bills } from '@/data/sample';
import { money } from '@/theme/tokens';

export default function BillsScreen() {
  const [selected, setSelected] = useState<(typeof bills)[number] | null>(null);
  return (
    <Screen title="My bills">
      <Text style={text.muted}>Your monthly statements and meter readings.</Text>
      {bills.map((bill) => (
        <RecordCard
          key={bill.id}
          title={bill.month}
          amount={money(bill.total)}
          details={bill.current - bill.previous + ' m\u00b3 - Due ' + bill.due}
          status={bill.paid >= bill.total ? 'Paid' : 'Unpaid'}
          paid={bill.paid >= bill.total}
          icon="bills"
          action="View bill"
          onPress={() => setSelected(bill)}
        />
      ))}
      <Sheet
        title={selected?.month || 'Bill details'}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <Detail label="Previous reading" value={selected.previous + ' m³'} />
            <Detail label="Current reading" value={selected.current + ' m³'} />
            <Detail label="Water consumed" value={selected.current - selected.previous + ' m³'} />
            <Detail label="Rate / m³" value={money(selected.rate)} />
            <Detail label="Water charge" value={money(selected.total)} />
            <Detail label="Other charges" value={money(0)} />
            <Detail label="Paid" value={money(selected.paid)} />
            <Detail label="Remaining balance" value={money(selected.total - selected.paid)} />
            <Text style={text.muted}>
              Please settle payments at the PWSS office and keep your receipt.
            </Text>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
