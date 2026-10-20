CREATE TABLE customer_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  application_number VARCHAR(40) NOT NULL,
  nature_of_work ENUM('New connection', 'Reconnection', 'Meter replacement', 'Service repair')
    NOT NULL DEFAULT 'New connection',
  status ENUM('Pending', 'Approved', 'Installed') NOT NULL DEFAULT 'Pending',
  date_applied DATE NOT NULL,
  date_approved DATE NULL,
  approved_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_applications_number (application_number),
  KEY idx_applications_customer (customer_id),
  KEY idx_applications_status_date (status, date_applied),
  KEY idx_applications_approved_by (approved_by),
  CONSTRAINT fk_applications_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_applications_approved_by FOREIGN KEY (approved_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
