import { RecordCard } from '@/components/consumer/RecordCard';
import { useState } from 'react';
import { Text } from 'react-native';
import { Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { bills, customer, payments } from '@/data/sample';
import { money } from '@/theme/tokens';

export default function PaymentsScreen() {
  const [selected, setSelected] = useState<(typeof payments)[number] | null>(null);
  const bill = bills.find((item) => item.id === selected?.billId);
  return (
    <Screen title="Payment history">
      {payments.map((payment) => (
        <RecordCard
          key={payment.receipt}
          title={payment.month}
          amount={money(payment.amount)}
          details={payment.date + ' - Cash'}
          status="Paid"
          paid
          icon="payments"
          action="View receipt"
          onPress={() => setSelected(payment)}
        />
      ))}
      <Sheet title="Payment receipt" visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <Text style={text.heading}>PIO DURAN WATER SUPPLY</Text>
            <Detail label="Receipt number" value={selected.receipt} />
            <Detail label="Customer" value={customer.name} />
            <Detail label="Date paid" value={selected.date} />
            <Detail label="Billing month" value={selected.month} />
            <Detail label="Previous reading" value={(bill?.previous ?? 0) + ' m³'} />
            <Detail label="Current reading" value={(bill?.current ?? 0) + ' m³'} />
            <Detail
              label="Water consumed"
              value={(bill?.current ?? 0) - (bill?.previous ?? 0) + ' m³'}
            />
            <Detail label="Amount paid" value={money(selected.amount)} />
            <Detail label="Payment method" value="Cash" />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
