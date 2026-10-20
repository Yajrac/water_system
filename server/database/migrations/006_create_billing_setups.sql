CREATE TABLE billing_setups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  barangay_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  billing_month DATE NOT NULL,
  due_date DATE NOT NULL,
  rate_per_cubic_meter DECIMAL(12, 2) UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_setups_barangay_month (barangay_id, billing_month),
  KEY idx_billing_setups_month (billing_month),
  KEY idx_billing_setups_created_by (created_by),
  CONSTRAINT fk_billing_setups_barangay FOREIGN KEY (barangay_id)
    REFERENCES barangays (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_billing_setups_created_by FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
