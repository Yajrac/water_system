CREATE TABLE bills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  meter_entry_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  generated_by BIGINT UNSIGNED NOT NULL,
  bill_number VARCHAR(40) NOT NULL,
  billing_month DATE NOT NULL,
  generated_on DATE NOT NULL,
  due_date DATE NOT NULL,
  previous_reading DECIMAL(15, 3) UNSIGNED NOT NULL,
  current_reading DECIMAL(15, 3) UNSIGNED NOT NULL,
  consumption DECIMAL(15, 3) UNSIGNED NOT NULL,
  rate_per_cubic_meter DECIMAL(12, 2) UNSIGNED NOT NULL,
  water_charge DECIMAL(15, 2) UNSIGNED NOT NULL,
  connection_charge DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  late_fee DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  other_charge DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 2) UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_bills_number (bill_number),
  UNIQUE KEY uq_bills_meter_entry (meter_entry_id),
  UNIQUE KEY uq_bills_customer_month (customer_id, billing_month),
  KEY idx_bills_barangay_month (barangay_id, billing_month),
  KEY idx_bills_due_date (due_date),
  KEY idx_bills_generated_by (generated_by),
  CONSTRAINT fk_bills_meter_entry FOREIGN KEY (meter_entry_id)
    REFERENCES meter_entries (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bills_barangay FOREIGN KEY (barangay_id)
    REFERENCES barangays (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bills_generated_by FOREIGN KEY (generated_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
