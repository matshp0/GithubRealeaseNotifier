-- Runs once on first Postgres container init (empty data volume).
-- Creates the database owned by the mail-verification service.
CREATE DATABASE mail_verification;
