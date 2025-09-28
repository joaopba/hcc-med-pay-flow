#!/bin/bash

echo "🚀 Fazendo deploy da aplicação..."

# Definir variáveis
APP_NAME="hcc-med-pay-flow"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"

# Criar diretórios necessários
sudo mkdir -p $DEPLOY_DIR
sudo mkdir -p $BACKUP_DIR
sudo chown -R $USER:$USER $DEPLOY_DIR

# Clonar ou atualizar repositório
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "📥 Atualizando código existente..."
    cd $DEPLOY_DIR
    git pull origin main
else
    echo "📥 Clonando repositório..."
    # SUBSTITUA pela URL do seu repositório
    git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git $DEPLOY_DIR
    cd $DEPLOY_DIR
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Criar arquivo de ambiente
echo "⚙️ Configurando variáveis de ambiente..."
cat > .env << EOF
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY_AQUI
EOF

# Build da aplicação
echo "🔨 Fazendo build da aplicação..."
npm run build

# Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo cp ../migration-guide/05-setup-nginx.conf /etc/nginx/sites-available/$APP_NAME

# Configurar domínio
DOMAIN="hcc.chatconquista.com"
echo "🌐 Usando domínio: $DOMAIN"

# Ativar site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração Nginx
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida"
    sudo systemctl reload nginx
    sudo systemctl enable nginx
else
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Iniciar Supabase
echo "🚀 Iniciando Supabase..."
cd ~/supabase-docker/supabase/docker
docker-compose up -d

# Aguardar Supabase inicializar
echo "⏳ Aguardando Supabase inicializar..."
sleep 30

# Executar migrações
echo "📊 Executando migrações do banco..."
PGPASSWORD="HCC_Med_2024_Strong!" psql -h localhost -U supabase -d postgres -f ../../../migration-guide/04-migrate-data.sql

echo ""
echo "🎉 Deploy concluído!"
echo ""
echo "📊 URLs importantes:"
echo "   Frontend: http://$DOMAIN"
echo "   Supabase API: http://$DOMAIN/api"
echo "   Supabase Dashboard: http://$DOMAIN/dashboard (admin/HCC_Admin_2024!)"
echo ""
echo "🔑 Chaves importantes:"
echo "   Anon Key: Verifique o arquivo ~/supabase-docker/supabase/docker/.env"
echo "   Service Role Key: Verifique o arquivo ~/supabase-docker/supabase/docker/.env"
echo ""
echo "📋 Próximos passos:"
echo "   1. Configure SSL com: sudo certbot --nginx -d $DOMAIN"
echo "   2. Configure backup automático"
echo "   3. Configure monitoramento"