#!/bin/bash

echo "🔧 Corrigindo configurações do Supabase local..."

# Instalar dependências Python necessárias
echo "📦 Instalando dependências..."
pip3 install PyJWT 2>/dev/null || echo "⚠️  PyJWT já instalado ou erro na instalação"

# Navegar para o diretório do Supabase
cd ~/supabase-docker/supabase/docker

# Parar os serviços
echo "⏹️  Parando serviços do Supabase..."
docker-compose down

# Gerar novas chaves se necessário
JWT_SECRET=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(python3 -c "
import jwt
import json
from datetime import datetime, timedelta

payload = {
    'role': 'service_role',
    'iss': 'supabase',
    'iat': int(datetime.now().timestamp()),
    'exp': int((datetime.now() + timedelta(years=10)).timestamp())
}

secret = '$JWT_SECRET'
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
")

ANON_KEY=$(python3 -c "
import jwt
import json
from datetime import datetime, timedelta

payload = {
    'role': 'anon',
    'iss': 'supabase',
    'iat': int(datetime.now().timestamp()),
    'exp': int((datetime.now() + timedelta(years=10)).timestamp())
}

secret = '$JWT_SECRET'
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
")

# Criar/atualizar arquivo .env com configurações completas
echo "📝 Atualizando arquivo .env..."
cat > .env << EOF
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
POSTGRES_PORT=5432

JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# API Gateway
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# API URL
API_EXTERNAL_URL=http://localhost:8000
SUPABASE_PUBLIC_URL=http://localhost:8000

# Dashboard
DASHBOARD_PORT=3000
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=HCC_Admin_2024!

# Database
DB_PORT=54322

# Studio
STUDIO_PORT=54323

# Auth
SITE_URL=http://hcc.chatconquista.com
ADDITIONAL_REDIRECT_URLS=""
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

# Email
SMTP_ADMIN_EMAIL=admin@hcchospital.com.br
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=HCC Med Pay Flow
ENABLE_EMAIL_SIGNUP=true
MAILER_URLPATHS_CONFIRMATION=/auth/confirm
MAILER_URLPATHS_INVITE=/auth/invite
MAILER_URLPATHS_EMAIL_CHANGE=/auth/update-email
MAILER_URLPATHS_RECOVERY=/auth/reset-password

# Storage
STORAGE_BACKEND=file
GLOBAL_S3_BUCKET=supabase-storage

# Imgproxy
IMGPROXY_ENABLE_WEBP_DETECTION=true

# Logging
LOGFLARE_API_KEY=
LOGFLARE_PROJECT_ID=
LOGFLARE_PRIVATE_ACCESS_TOKEN=
LOGFLARE_PUBLIC_ACCESS_TOKEN=

# Pooler
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_TENANT_ID=
POOLER_DB_POOL_SIZE=10

# Functions
FUNCTIONS_VERIFY_JWT=false

# Vault
VAULT_ENC_KEY=$(openssl rand -base64 32)

# Secret key base
SECRET_KEY_BASE=$(openssl rand -base64 32)

# Docker
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
EOF

echo "🚀 Iniciando Supabase com novas configurações..."
docker-compose up -d

echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Verificar se o banco está funcionando
echo "🔍 Verificando banco de dados..."
while ! docker-compose exec -T db pg_isready -U postgres; do
    echo "⏳ Aguardando banco de dados..."
    sleep 5
done

echo "📊 Configurando auth schema corretamente..."
docker-compose exec -T db psql -U postgres -d postgres << 'EOSQL'
-- Garantir que o schema auth existe e tem as funções necessárias
CREATE SCHEMA IF NOT EXISTS auth;

-- Criar função auth.uid() se não existir
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  )::uuid;
$$;

-- Criar função auth.role() se não existir  
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
  );
$$;

-- Garantir que as tabelas básicas do auth existem
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE,
    encrypted_password text,
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token text,
    confirmation_sent_at timestamptz,
    recovery_token text,
    recovery_sent_at timestamptz,
    email_change_token_new text,
    email_change text,
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    phone text,
    phone_confirmed_at timestamptz,
    phone_change text,
    phone_change_token text,
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current text,
    email_change_confirm_status smallint,
    banned_until timestamptz,
    reauthentication_token text,
    reauthentication_sent_at timestamptz,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamptz
);

-- Recriar as políticas RLS que falharam
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles; 
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can delete profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_manager(auth.uid()));

EOSQL

echo "🔧 Configurando webhook para usar o ambiente correto..."

# Atualizar o arquivo de configuração do projeto
cd /var/www/hcc-med-pay-flow
cat > .env << EOF
VITE_SUPABASE_URL=http://hcc.chatconquista.com/api
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
EOF

echo "✅ Configuração do Supabase corrigida!"
echo ""
echo "🔑 Chaves atualizadas:"
echo "   Anon Key: $ANON_KEY"
echo "   Service Role Key: $SERVICE_ROLE_KEY"
echo ""
echo "📋 Próximos passos:"
echo "   1. Teste o webhook: curl -X POST http://hcc.chatconquista.com/functions/v1/webhook-handler"
echo "   2. Acesse o dashboard: http://hcc.chatconquista.com/dashboard"
echo "   3. Configure SSL: sudo certbot --nginx -d hcc.chatconquista.com"