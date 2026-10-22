CREATE TABLE notification_reads (
  user_id BIGINT UNSIGNED NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, notification_key),
  CONSTRAINT fk_notification_read_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE push_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uq_push_token(token),
  KEY idx_push_device_user(user_id),
  CONSTRAINT fk_push_device_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE push_deliveries (
  device_id BIGINT UNSIGNED NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  ticket_id VARCHAR(255) NULL,
  status ENUM('Pending','Accepted','Delivered','Failed') NOT NULL DEFAULT 'Pending',
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(device_id, notification_key),
  CONSTRAINT fk_push_delivery_device FOREIGN KEY(device_id) REFERENCES push_devices(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
