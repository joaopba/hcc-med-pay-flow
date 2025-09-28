#!/bin/bash

echo "🚀 Configurando Supabase Self-Hosted..."

# Criar diretório para Supabase
mkdir -p ~/supabase-docker
cd ~/supabase-docker

# Baixar configuração do Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiar exemplo de configuração
cp .env.example .env

# Gerar JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(openssl rand -base64 32)

# Configurar .env
cat > .env << EOF
############
# Secrets
############
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=HCC_Admin_2024!

############
# Database
############
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=supabase
POSTGRES_PASSWORD=HCC_Med_2024_Strong!

############
# API Proxy
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API
############
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_OPENAPI_MODE=ignore_privileges
PGRST_OPENAPI_SECURITY_ACTIVE=false

############
# Auth
############
GOTRUE_API_HOST=0.0.0.0
GOTRUE_API_PORT=9999
API_EXTERNAL_URL=http://localhost:8000
GOTRUE_URL=http://localhost:8000
GOTRUE_JWT_SECRET=$JWT_SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_ROLE=authenticated
GOTRUE_DB_DRIVER=postgres
GOTRUE_DB_DATABASE_URL=postgresql://supabase:HCC_Med_2024_Strong!@host.docker.internal:5432/postgres?search_path=auth
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_URI_ALLOW_LIST=
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_JWT_ADMIN_GROUP_NAME=admin
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_ROLE=authenticated
GOTRUE_JWT_EXP=3600
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_ADMIN_EMAIL=admin@localhost
GOTRUE_SMTP_HOST=localhost
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=
GOTRUE_SMTP_PASS=
GOTRUE_SMTP_MAX_FREQUENCY=1m
GOTRUE_EXTERNAL_PHONE_ENABLED=true
GOTRUE_SMS_AUTOCONFIRM=true

############
# Email Auth
############
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true
GOTRUE_MAILER_OTP_EXP=86400
GOTRUE_MAILER_OTP_LENGTH=6

############
# Storage
############
STORAGE_BACKEND=file
STORAGE_FILE_SIZE_LIMIT=52428800
STORAGE_S3_BUCKET=stub
FILE_SIZE_LIMIT=52428800
STORAGE_S3_REGION=stub
STORAGE_S3_ENDPOINT=stub
GLOBAL_S3_BUCKET=stub

############
# Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Logs
############
LOGFLARE_API_KEY=your-api-key

############
# Dashboard
############
SUPABASE_PUBLIC_URL=http://localhost:8000
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_KEY=$SERVICE_ROLE_KEY

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project

STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=http://localhost:8000

PUBLIC_REST_URL=http://localhost:8000/rest/v1/
PUBLIC_ANON_KEY=$ANON_KEY
PUBLIC_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

SERVICE_KEY=$SERVICE_ROLE_KEY
EOF

echo "✅ Supabase configurado!"
echo "🔑 Anon Key: $ANON_KEY"
echo "🔑 Service Role Key: $SERVICE_ROLE_KEY"
echo ""
echo "📋 Próximo passo: Execute o script 04-migrate-data.sh"