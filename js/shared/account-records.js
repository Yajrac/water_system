// Local admin records. Existing bills and payments are never deleted here.
const AccountRecords = {
  disconnect(records, customerId, reason) {
    const customer = records.customers.find((item) => item.id === customerId);
    if (!customer || !WaterStore.isRegistered(customer) || !WaterStore.isActive(customer))
      throw new Error('Choose an active registered customer.');
    if (!reason.trim() || reason.trim().length > 500 || /[<>]/.test(reason))
      throw new Error('Enter a reason of 1–500 characters without HTML tags.');
    records.disconnections = records.disconnections || [];
    if (
      records.disconnections.some((item) => item.customerId === customerId && !item.reconnectedOn)
    )
      throw new Error('This account is already disconnected.');
    const entry = {
      id: WaterStore.id(),
      customerId,
      reason: reason.trim(),
      disconnectedOn: WaterStore.today(),
      reconnectedOn: null,
    };
    records.disconnections.push(entry);
    customer.connectionStatus = 'Disconnected';
    customer.active = false;
    customer.statusChangedOn = entry.disconnectedOn;
    return entry;
  },
  reconnect(records, id) {
    const entry = (records.disconnections || []).find((item) => item.id === id);
    if (!entry || entry.reconnectedOn) throw new Error('This disconnection is no longer open.');
    const customer = records.customers.find((item) => item.id === entry.customerId);
    if (!customer) throw new Error('The customer record could not be found.');
    entry.reconnectedOn = WaterStore.today();
    customer.connectionStatus = 'Connected';
    customer.active = true;
    customer.statusChangedOn = entry.reconnectedOn;
  },
  addFeedback(records, customerId, category, message) {
    if (!records.customers.some((customer) => customer.id === customerId))
      throw new Error('Select a saved customer.');
    if (!['Billing', 'Water supply', 'Meter', 'Other'].includes(category))
      throw new Error('Select a valid feedback category.');
    if (!message.trim() || message.trim().length > 1500 || /[<>]/.test(message))
      throw new Error('Enter feedback of 1–1500 characters without HTML tags.');
    const entry = {
      id: WaterStore.id(),
      customerId,
      category,
      message: message.trim(),
      status: 'New',
      date: WaterStore.today(),
      notes: '',
    };
    records.feedback = records.feedback || [];
    records.feedback.push(entry);
    return entry;
  },
  updateFeedback(records, id, status, notes) {
    const entry = (records.feedback || []).find((item) => item.id === id);
    if (!entry) throw new Error('Feedback no longer exists.');
    if (!['New', 'In progress', 'Resolved'].includes(status))
      throw new Error('Choose a valid feedback status.');
    if (notes.length > 1500 || /[<>]/.test(notes))
      throw new Error('Notes must be under 1500 characters without HTML tags.');
    entry.status = status;
    entry.notes = notes.trim();
    entry.updatedOn = WaterStore.today();
  },
  replyToFeedback(records, id, message) {
    const entry = (records.feedback || []).find((item) => item.id === id);
    if (!entry) throw new Error('Feedback no longer exists.');
    const text = message.trim();
    if (!text || text.length > 1500 || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
      throw new Error(
        'Reply must contain 1–1500 characters without HTML tags or control characters.',
      );
    const reply = {
      id: WaterStore.id(),
      author: 'Admin',
      message: text,
      date: WaterStore.today(),
      createdAt: new Date().toISOString(),
    };
    entry.replies = entry.replies || [];
    entry.replies.push(reply);
    entry.updatedOn = reply.date;
    return reply;
  },
};
