CREATE TABLE barangays (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  psgc_code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  municipality VARCHAR(100) NOT NULL DEFAULT 'Pio Duran',
  province VARCHAR(100) NOT NULL DEFAULT 'Albay',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_barangays_psgc_code (psgc_code),
  UNIQUE KEY uq_barangays_location (province, municipality, name)
) ENGINE = InnoDB;
