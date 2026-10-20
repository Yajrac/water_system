CREATE TABLE customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  account_number VARCHAR(40) NOT NULL,
  submitter_number VARCHAR(40) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  middle_name VARCHAR(60) NULL,
  last_name VARCHAR(60) NOT NULL,
  extension_name ENUM('Jr.', 'Sr.', 'II', 'III', 'IV', 'V') NULL,
  gender ENUM('Male', 'Female') NOT NULL,
  contact_number VARCHAR(16) NOT NULL,
  purok VARCHAR(40) NOT NULL,
  street VARCHAR(200) NULL,
  customer_type ENUM('Residential', 'Commercial') NOT NULL DEFAULT 'Residential',
  connection_status ENUM('Active', 'Inactive', 'Disconnected') NOT NULL DEFAULT 'Inactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_user (user_id),
  UNIQUE KEY uq_customers_account (account_number),
  UNIQUE KEY uq_customers_submitter (submitter_number),
  KEY idx_customers_barangay_status (barangay_id, connection_status),
  KEY idx_customers_name (last_name, first_name),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_customers_barangay FOREIGN KEY (barangay_id)
    REFERENCES barangays (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
