ALTER TABLE meter_entries ADD COLUMN late_fee_basis LONGTEXT NULL;

CREATE TABLE late_fee_assessments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_bill_id BIGINT UNSIGNED NOT NULL,
  meter_entry_id BIGINT UNSIGNED NOT NULL,
  through_date DATE NOT NULL,
  amount DECIMAL(12, 2) UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_late_fee_source_entry (source_bill_id, meter_entry_id),
  KEY idx_late_fee_entry (meter_entry_id),
  CONSTRAINT fk_late_fee_source FOREIGN KEY (source_bill_id) REFERENCES bills(id),
  CONSTRAINT fk_late_fee_entry FOREIGN KEY (meter_entry_id) REFERENCES meter_entries(id)
) ENGINE = InnoDB;
