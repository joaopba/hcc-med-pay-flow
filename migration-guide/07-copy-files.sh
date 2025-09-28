#!/bin/bash

echo "📁 Preparando para copiar arquivos do projeto..."

# Definir variáveis
APP_NAME="hcc-med-pay-flow"
DEPLOY_DIR="/var/www/$APP_NAME"

echo ""
echo "📋 Instruções para copiar arquivos:"
echo ""
echo "1️⃣ No seu computador local (onde está o projeto):"
echo "   cd /caminho/para/seu/projeto"
echo "   tar -czf projeto.tar.gz --exclude=node_modules --exclude=.git ."
echo ""
echo "2️⃣ Enviar para o servidor:"
echo "   scp projeto.tar.gz root@SEU_IP_VPS:/tmp/"
echo ""
echo "3️⃣ No servidor (execute aqui):"
echo "   cd /tmp"
echo "   tar -xzf projeto.tar.gz -C $DEPLOY_DIR"
echo "   chown -R root:root $DEPLOY_DIR"
echo ""
echo "4️⃣ Depois execute:"
echo "   ./06-deploy-app.sh"
echo ""

# Criar diretório de deploy
echo "📁 Criando diretório de deploy..."
sudo mkdir -p $DEPLOY_DIR
sudo chown -R $USER:$USER $DEPLOY_DIR

echo ""
echo "✅ Diretório preparado: $DEPLOY_DIR"
echo "📋 Siga as instruções acima para copiar os arquivos"