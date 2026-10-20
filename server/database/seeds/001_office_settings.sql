INSERT INTO office_settings (
  id,
  office_name,
  office_address
)
VALUES (
  1,
  'Pio Duran Water Supply System',
  'Pio Duran, Albay'
)
ON DUPLICATE KEY UPDATE
  id = office_settings.id;
