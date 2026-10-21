CREATE TABLE announcement_recipients (
  announcement_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (announcement_id, customer_id),
  KEY idx_announcement_recipient_customer (customer_id),
  CONSTRAINT fk_announcement_recipient_notice FOREIGN KEY (announcement_id)
    REFERENCES announcements(id) ON DELETE RESTRICT,
  CONSTRAINT fk_announcement_recipient_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE RESTRICT
) ENGINE = InnoDB;
