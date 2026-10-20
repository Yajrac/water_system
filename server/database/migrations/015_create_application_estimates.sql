CREATE TABLE application_estimates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  installation_fee DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  setback_length DECIMAL(12, 3) UNSIGNED NOT NULL DEFAULT 0,
  setback_rate DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  reinstallation_fee DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  violation_fee DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_application_estimates_application (application_id),
  CONSTRAINT fk_application_estimates_application FOREIGN KEY (application_id)
    REFERENCES customer_applications (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
