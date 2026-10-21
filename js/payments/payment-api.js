const PaymentAPI = {
  async receipt(id) {
    return this.receiptData(await AdminAPI.request('/payments/' + encodeURIComponent(id)));
  },
  receiptData(data) {
    const amounts = [
      'previous',
      'current',
      'consumption',
      'ratePerCubic',
      'water',
      'connection',
      'late',
      'other',
      'total',
      'amount',
      'balanceBefore',
      'balanceAfter',
    ];
    const numbers = (row) => ({
      ...row,
      ...Object.fromEntries(
        amounts.filter((key) => row[key] !== undefined).map((key) => [key, Number(row[key])]),
      ),
    });
    return {
      ...data,
      bill: numbers(data.bill),
      payment: { ...numbers(data.payment), allocations: data.payment.allocations.map(numbers) },
    };
  },
};
