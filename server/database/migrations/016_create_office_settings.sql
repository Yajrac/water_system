CREATE TABLE office_settings (
  id TINYINT UNSIGNED NOT NULL,
  office_name VARCHAR(150) NOT NULL,
  office_address VARCHAR(255) NOT NULL,
  contact_number VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_office_settings_updated_by (updated_by),
  CONSTRAINT fk_office_settings_updated_by FOREIGN KEY (updated_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_office_settings_singleton CHECK (id = 1)
) ENGINE = InnoDB;
