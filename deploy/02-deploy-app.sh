#!/bin/bash

echo "🚀 Fazendo deploy da aplicação HCC Med Pay Flow..."

# Definir variáveis
APP_DIR="/var/www/hcc-med-pay-flow"
DOMAIN="hcc.chatconquista.com"

# Copiar arquivos da aplicação
echo "📁 Copiando arquivos da aplicação..."
cp -r ../src $APP_DIR/
cp -r ../public $APP_DIR/
cp ../package*.json $APP_DIR/
cp ../vite.config.ts $APP_DIR/
cp ../tailwind.config.ts $APP_DIR/
cp ../tsconfig*.json $APP_DIR/
cp ../index.html $APP_DIR/
cp ../components.json $APP_DIR/
cp ../postcss.config.js $APP_DIR/
cp ../.env $APP_DIR/

# Instalar dependências
echo "📦 Instalando dependências..."
cd $APP_DIR
npm install

# Fazer build da aplicação
echo "🔨 Fazendo build da aplicação..."
npm run build

# Configurar variáveis de ambiente de produção
echo "⚙️ Configurando variáveis de ambiente..."
cat > $APP_DIR/.env << EOF
VITE_SUPABASE_URL=https://nnytrkgsjajsecotasqv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4
VITE_SUPABASE_PROJECT_ID=nnytrkgsjajsecotasqv
EOF

# Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/hcc-med-pay-flow > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    root /var/www/hcc-med-pay-flow/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # Security - deny access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~* \.(env|log)$ {
        deny all;
    }
}
EOF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/hcc-med-pay-flow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
echo "🔍 Testando configuração do Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida"
    sudo systemctl reload nginx
    sudo systemctl enable nginx
else
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Configurar permissões
sudo chown -R www-data:www-data /var/www/hcc-med-pay-flow
sudo chmod -R 755 /var/www/hcc-med-pay-flow

echo "✅ Deploy concluído com sucesso!"
echo "📋 Próximo passo: Execute ./03-setup-ssl.sh $DOMAIN"