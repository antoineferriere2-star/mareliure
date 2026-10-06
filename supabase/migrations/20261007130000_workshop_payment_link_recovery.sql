-- Ciphertext allows an authenticated workshop owner to resend the same link.
-- The public token's SHA-256 remains the lookup credential; the AES key is a separate Worker secret.
ALTER TABLE public.marketplace_workshop_online_payments ADD COLUMN sealed_token text;
