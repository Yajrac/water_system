CREATE TABLE water_meters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NULL,
  meter_number VARCHAR(120) NOT NULL,
  meter_kind VARCHAR(120) NULL,
  meter_size VARCHAR(40) NULL,
  initial_reading DECIMAL(15, 3) UNSIGNED NOT NULL DEFAULT 0,
  current_reading DECIMAL(15, 3) UNSIGNED NOT NULL DEFAULT 0,
  date_installed DATE NOT NULL,
  date_removed DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_water_meters_number (meter_number),
  KEY idx_water_meters_customer_active (customer_id, is_active),
  KEY idx_water_meters_application (application_id),
  CONSTRAINT fk_water_meters_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_water_meters_application FOREIGN KEY (application_id)
    REFERENCES customer_applications (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
