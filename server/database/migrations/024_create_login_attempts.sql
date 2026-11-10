CREATE TABLE login_attempts (
  attempt_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL
) ENGINE=InnoDB;
