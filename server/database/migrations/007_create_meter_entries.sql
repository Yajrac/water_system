CREATE TABLE meter_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  billing_setup_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  meter_id BIGINT UNSIGNED NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  previous_reading DECIMAL(15, 3) UNSIGNED NOT NULL,
  consumption DECIMAL(15, 3) UNSIGNED NOT NULL,
  current_reading DECIMAL(15, 3)
    GENERATED ALWAYS AS (previous_reading + consumption) STORED,
  connection_charge DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  late_fee DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  other_charge DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('Saved', 'Billed') NOT NULL DEFAULT 'Saved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_meter_entries_setup_customer (billing_setup_id, customer_id),
  KEY idx_meter_entries_customer (customer_id),
  KEY idx_meter_entries_meter (meter_id),
  KEY idx_meter_entries_recorded_by (recorded_by),
  KEY idx_meter_entries_setup_status (billing_setup_id, status),
  CONSTRAINT fk_meter_entries_setup FOREIGN KEY (billing_setup_id)
    REFERENCES billing_setups (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_meter_entries_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_meter_entries_meter FOREIGN KEY (meter_id)
    REFERENCES water_meters (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_meter_entries_recorded_by FOREIGN KEY (recorded_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
