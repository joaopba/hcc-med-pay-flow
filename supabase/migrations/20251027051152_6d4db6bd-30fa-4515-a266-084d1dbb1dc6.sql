-- Adicionar campo para horário previsto de retorno do sistema
ALTER TABLE public.configuracoes 
ADD COLUMN horario_previsto_retorno timestamp with time zone;