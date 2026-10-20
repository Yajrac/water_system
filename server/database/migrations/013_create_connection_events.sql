CREATE TABLE connection_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  previous_status ENUM('Active', 'Inactive', 'Disconnected') NOT NULL,
  new_status ENUM('Active', 'Inactive', 'Disconnected') NOT NULL,
  reason VARCHAR(500) NOT NULL,
  effective_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_connection_events_customer_date (customer_id, effective_at, id),
  KEY idx_connection_events_performed_by (performed_by),
  CONSTRAINT fk_connection_events_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_connection_events_performed_by FOREIGN KEY (performed_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
