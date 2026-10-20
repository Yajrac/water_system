CREATE TABLE feedback_threads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  category ENUM('Billing', 'Water supply', 'Meter', 'Other') NOT NULL DEFAULT 'Other',
  status ENUM('New', 'In progress', 'Resolved') NOT NULL DEFAULT 'New',
  internal_notes TEXT NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_feedback_customer (customer_id),
  KEY idx_feedback_status_created (status, created_at),
  CONSTRAINT fk_feedback_threads_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE feedback_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(1500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_feedback_messages_thread (thread_id, created_at, id),
  KEY idx_feedback_messages_sender (sender_id),
  CONSTRAINT fk_feedback_messages_thread FOREIGN KEY (thread_id)
    REFERENCES feedback_threads (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_feedback_messages_sender FOREIGN KEY (sender_id)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
