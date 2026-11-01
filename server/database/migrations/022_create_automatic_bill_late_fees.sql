ALTER TABLE bills ADD COLUMN late_fee_next_on DATE NULL,
  ADD KEY idx_bills_late_fee_next (late_fee_next_on, id);

CREATE TABLE bill_late_fee_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bill_id BIGINT UNSIGNED NOT NULL,
  assessed_on DATE NOT NULL,
  balance_before DECIMAL(15, 2) UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bill_late_fee_period (bill_id, assessed_on),
  CONSTRAINT fk_bill_late_fee_event FOREIGN KEY (bill_id) REFERENCES bills(id)
) ENGINE = InnoDB;

-- Receipts keep the amounts approved at payment time even if later fees accrue.
ALTER TABLE payments
  ADD COLUMN bill_total_at_payment DECIMAL(15, 2) UNSIGNED NULL,
  ADD COLUMN bill_late_fee_at_payment DECIMAL(12, 2) UNSIGNED NULL;
UPDATE payments p JOIN bills b ON b.id = p.bill_id
  SET p.bill_total_at_payment = b.total_amount, p.bill_late_fee_at_payment = b.late_fee;
