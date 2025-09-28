-- Create table to track allowed broadcast numbers for invoice-related messages
CREATE TABLE IF NOT EXISTS public.disparos_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  pagamento_id uuid NULL,
  tipo text NOT NULL CHECK (tipo IN ('nota','pagamento','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by number
CREATE INDEX IF NOT EXISTS idx_disparos_notas_numero ON public.disparos_notas (numero);
CREATE INDEX IF NOT EXISTS idx_disparos_notas_created_at ON public.disparos_notas (created_at DESC);

-- Enable RLS
ALTER TABLE public.disparos_notas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view disparos_notas"
  ON public.disparos_notas FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert disparos_notas"
  ON public.disparos_notas FOR INSERT
  WITH CHECK (true);