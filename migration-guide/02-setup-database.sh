#!/bin/bash

echo "🐘 Configurando PostgreSQL..."

# Configurar PostgreSQL
sudo -u postgres psql << EOF
-- Criar usuário e database
CREATE USER supabase WITH PASSWORD 'HCC_Med_2024_Strong!';
CREATE DATABASE postgres OWNER supabase;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase;

-- Configurações adicionais
ALTER USER supabase CREATEDB;
ALTER USER supabase WITH SUPERUSER;
\q
EOF

# Configurar acesso remoto ao PostgreSQL
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "host all all 0.0.0.0/0 md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
sudo systemctl enable postgresql

echo "✅ PostgreSQL configurado!"
echo "📋 Próximo passo: Execute o script 03-setup-supabase.sh"