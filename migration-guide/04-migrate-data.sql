-- Script de migração completa dos dados
-- Execute este arquivo no PostgreSQL da VPS

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Criar schemas necessários
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS public;

-- Criar tipos personalizados
CREATE TYPE public.payment_status AS ENUM ('pendente', 'solicitado', 'aprovado', 'pago', 'cancelado');
CREATE TYPE public.user_role AS ENUM ('usuario', 'gestor');

-- Tabela de configurações
CREATE TABLE public.configuracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    api_url text DEFAULT 'https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb'::text NOT NULL,
    auth_token text NOT NULL,
    webhook_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email_notificacoes boolean DEFAULT true NOT NULL
);

-- Tabela de médicos
CREATE TABLE public.medicos (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    especialidade text,
    cpf text,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nome text NOT NULL,
    numero_whatsapp text NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    role public.user_role DEFAULT 'usuario'::public.user_role NOT NULL
);

-- Tabela de pagamentos
CREATE TABLE public.pagamentos (
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    data_pagamento timestamp with time zone,
    data_resposta timestamp with time zone,
    data_solicitacao timestamp with time zone,
    status public.payment_status DEFAULT 'pendente'::public.payment_status NOT NULL,
    valor numeric NOT NULL,
    medico_id uuid NOT NULL,
    mes_competencia text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nota_pdf_url text,
    comprovante_url text,
    observacoes text,
    valor_liquido numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Tabela de notas dos médicos
CREATE TABLE public.notas_medicos (
    observacoes text,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    medico_id uuid NOT NULL,
    pagamento_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    arquivo_url text NOT NULL,
    nome_arquivo text NOT NULL
);

-- Tabelas de controle de mensagens
CREATE TABLE public.message_locks (
    tipo text NOT NULL,
    numero text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:00:30'::interval) NOT NULL,
    UNIQUE(numero, tipo)
);

CREATE TABLE public.message_logs (
    tipo text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pagamento_id uuid NOT NULL,
    payload jsonb NOT NULL,
    response jsonb,
    success boolean DEFAULT false NOT NULL
);

-- Tabela de logs de webhook
CREATE TABLE public.webhook_debug_logs (
    timestamp timestamp with time zone DEFAULT now() NOT NULL,
    method text NOT NULL,
    url text NOT NULL,
    headers jsonb,
    query_params jsonb,
    raw_body text,
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_agent text,
    content_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parsed_body jsonb
);

-- Tabela de disparos de notas
CREATE TABLE public.disparos_notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tipo text NOT NULL,
    numero text NOT NULL,
    pagamento_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparos_notas ENABLE ROW LEVEL SECURITY;

-- Criar funções
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_manager(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = 'gestor'
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 
    NEW.email,
    'usuario'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clean_rejected_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pendente' THEN
    DELETE FROM public.notas_medicos 
    WHERE pagamento_id = NEW.pagamento_id 
    AND status = 'rejeitado';
  END IF;
  RETURN NEW;
END;
$function$;

-- Criar triggers
CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medicos_updated_at
    BEFORE UPDATE ON public.medicos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pagamentos_updated_at
    BEFORE UPDATE ON public.pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notas_medicos_updated_at
    BEFORE UPDATE ON public.notas_medicos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS
-- Configurações
CREATE POLICY "Authenticated users can manage configuracoes" ON public.configuracoes FOR ALL USING (true);
CREATE POLICY "Authenticated users can view configuracoes" ON public.configuracoes FOR SELECT USING (true);

-- Médicos
CREATE POLICY "Authenticated users can manage medicos" ON public.medicos FOR ALL USING (true);
CREATE POLICY "Authenticated users can view medicos" ON public.medicos FOR SELECT USING (true);

-- Profiles
CREATE POLICY "Managers can view all profiles" ON public.profiles FOR SELECT USING (is_manager(auth.uid()));
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Managers can insert profiles" ON public.profiles FOR INSERT WITH CHECK (is_manager(auth.uid()));
CREATE POLICY "Managers can update any profile" ON public.profiles FOR UPDATE USING (is_manager(auth.uid()));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Managers can delete profiles" ON public.profiles FOR DELETE USING (is_manager(auth.uid()));

-- Pagamentos
CREATE POLICY "Authenticated users can manage pagamentos" ON public.pagamentos FOR ALL USING (true);
CREATE POLICY "Authenticated users can view pagamentos" ON public.pagamentos FOR SELECT USING (true);

-- Notas médicos
CREATE POLICY "Anyone can insert notas_medicos" ON public.notas_medicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view notas_medicos" ON public.notas_medicos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update notas_medicos" ON public.notas_medicos FOR UPDATE USING (true);

-- Message locks
CREATE POLICY "Authenticated users can view message_locks" ON public.message_locks FOR SELECT USING (true);

-- Message logs
CREATE POLICY "Authenticated users can manage message_logs" ON public.message_logs FOR ALL USING (true);
CREATE POLICY "Authenticated users can view message_logs" ON public.message_logs FOR SELECT USING (true);

-- Webhook debug logs
CREATE POLICY "Authenticated users can insert webhook logs" ON public.webhook_debug_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view webhook logs" ON public.webhook_debug_logs FOR SELECT USING (true);

-- Disparos notas
CREATE POLICY "Authenticated users can insert disparos_notas" ON public.disparos_notas FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view disparos_notas" ON public.disparos_notas FOR SELECT USING (true);

-- Configuração inicial
INSERT INTO public.configuracoes (api_url, auth_token, email_notificacoes) 
VALUES (
    'https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb',
    'SEU_TOKEN_AQUI',
    true
) ON CONFLICT DO NOTHING;