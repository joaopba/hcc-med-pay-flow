-- Tabela para locks de mensagens WhatsApp (evitar envios simultâneos)
CREATE TABLE IF NOT EXISTS public.message_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  tipo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 seconds')
);

-- Um lock por (numero, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS ux_message_locks_numero_tipo ON public.message_locks (numero, tipo);

-- Habilitar RLS
ALTER TABLE public.message_locks ENABLE ROW LEVEL SECURITY;

-- Permitir visualização por usuários autenticados (útil para auditoria)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'message_locks' 
      AND policyname = 'Authenticated users can view message_locks'
  ) THEN
    CREATE POLICY "Authenticated users can view message_locks"
    ON public.message_locks
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END$$;