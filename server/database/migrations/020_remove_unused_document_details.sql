-- Removes retired application fields and their stored values.
-- Back up application_documents before applying this migration.
ALTER TABLE application_documents
  DROP COLUMN contract_signed_date,
  DROP COLUMN acknowledgement_date,
  DROP COLUMN ctc_number,
  DROP COLUMN ctc_issued_date,
  DROP COLUMN ctc_issued_place,
  DROP COLUMN representative_ctc_number,
  DROP COLUMN representative_ctc_issued_date,
  DROP COLUMN representative_ctc_issued_place,
  DROP COLUMN notes;
