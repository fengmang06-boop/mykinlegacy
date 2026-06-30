-- Add mock provider for Milestone 10 email delivery foundation.
ALTER TABLE `email_logs`
  MODIFY `provider` ENUM('mock', 'resend', 'sendgrid', 'ses') NOT NULL;
