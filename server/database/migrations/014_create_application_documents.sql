CREATE TABLE application_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  certificate_received TINYINT(1) NOT NULL DEFAULT 0,
  contract_received TINYINT(1) NOT NULL DEFAULT 0,
  acknowledgement_received TINYINT(1) NOT NULL DEFAULT 0,
  contract_signed_date DATE NULL,
  acknowledgement_date DATE NULL,
  ctc_number VARCHAR(120) NULL,
  ctc_issued_date DATE NULL,
  ctc_issued_place VARCHAR(120) NULL,
  representative_ctc_number VARCHAR(120) NULL,
  representative_ctc_issued_date DATE NULL,
  representative_ctc_issued_place VARCHAR(120) NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_application_documents_application (application_id),
  CONSTRAINT fk_application_documents_application FOREIGN KEY (application_id)
    REFERENCES customer_applications (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
