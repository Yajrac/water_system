ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER must_change_password;
