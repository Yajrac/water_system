CREATE TABLE announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
  audience ENUM('All', 'Selected barangays') NOT NULL DEFAULT 'All',
  published_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_announcements_status_published (status, published_at),
  KEY idx_announcements_created_by (created_by),
  CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE announcement_barangays (
  announcement_id BIGINT UNSIGNED NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,

  PRIMARY KEY (announcement_id, barangay_id),
  KEY idx_announcement_barangays_barangay (barangay_id),
  CONSTRAINT fk_announcement_barangays_announcement FOREIGN KEY (announcement_id)
    REFERENCES announcements (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_announcement_barangays_barangay FOREIGN KEY (barangay_id)
    REFERENCES barangays (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
