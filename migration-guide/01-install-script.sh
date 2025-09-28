#!/bin/bash

# Script de instalação completa para VPS Ubuntu
# Execute como usuário comum (não root)

echo "🚀 Iniciando instalação do HCC Med Pay Flow na VPS..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

echo "📦 Instalando dependências básicas..."
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx build-essential

# Instalar Node.js 18
echo "📦 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
echo "🐘 Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Instalar Docker
echo "🐳 Instalando Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "✅ Instalação básica concluída!"
echo "⚠️  IMPORTANTE: Faça logout e login novamente para aplicar as permissões do Docker"
echo "📋 Próximo passo: Execute o script 02-setup-database.sh"