CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bill_id BIGINT UNSIGNED NOT NULL,
  collected_by BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(40) NOT NULL,
  request_key VARCHAR(64) NOT NULL,
  amount DECIMAL(15, 2) UNSIGNED NOT NULL,
  payment_method ENUM('Cash', 'Bank transfer') NOT NULL DEFAULT 'Cash',
  reference_number VARCHAR(100) NULL,
  remarks VARCHAR(500) NULL,
  paid_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_receipt (receipt_number),
  UNIQUE KEY uq_payments_request (request_key),
  KEY idx_payments_bill (bill_id),
  KEY idx_payments_paid_at (paid_at),
  KEY idx_payments_collector (collected_by),
  CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id)
    REFERENCES bills (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_payments_collector FOREIGN KEY (collected_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
