ALTER TABLE `house_identity_versions`
  MODIFY `schema_version` VARCHAR(64) NOT NULL;

ALTER TABLE `consent_records`
  MODIFY `schema_version` VARCHAR(64) NOT NULL;
