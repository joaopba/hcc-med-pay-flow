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
    echo "⚠️  Configure o repositório Git manualmente ou copie os arquivos"
    echo "📁 Por enquanto, vamos criar a estrutura básica..."
    mkdir -p $DEPLOY_DIR
    cd $DEPLOY_DIR
fi

# Copiar arquivos do projeto (temporário até ter Git configurado)
echo "📁 Você precisa copiar os arquivos do projeto para $DEPLOY_DIR"
echo "📁 Execute: scp -r ./seu-projeto/* root@seu-servidor:$DEPLOY_DIR/"
echo ""
echo "⏸️  O deploy será pausado aqui. Execute novamente após copiar os arquivos."

# Verificar se existe package.json
if [ ! -f "$DEPLOY_DIR/package.json" ]; then
    echo "❌ package.json não encontrado em $DEPLOY_DIR"
    echo "📋 Copie os arquivos do projeto primeiro e execute o script novamente"
    exit 1
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Criar arquivo de ambiente
echo "⚙️ Configurando variáveis de ambiente..."
cat > .env << EOF
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=ZTCoH/MfMPZY8+JQ6GKDiJ8ibEFJKSPa/qFWeTxwO20=
EOF

# Build da aplicação
echo "🔨 Fazendo build da aplicação..."
npm run build

# Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo cp ./05-setup-nginx.conf /etc/nginx/sites-available/$APP_NAME

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