-- Add text location field to caregiver_profiles for WhatsApp registrations
ALTER TABLE public.caregiver_profiles
  ADD COLUMN IF NOT EXISTS service_area text;

-- WhatsApp conversation sessions (30-min TTL enforced in application layer)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id              uuid        NOT NULL DEFAULT uuid_generate_v4(),
  whatsapp_number text        NOT NULL,
  flow_id         text        NOT NULL,
  current_step    text        NOT NULL,
  data            jsonb       NOT NULL DEFAULT '{}',
  job_id          uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_sessions_whatsapp_number_key UNIQUE (whatsapp_number)
);