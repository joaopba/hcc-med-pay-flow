# 🚀 Guia de Migração HCC Med Pay Flow para VPS

Este guia te ajudará a migrar completamente o sistema HCC Med Pay Flow do Supabase Cloud para sua VPS Ubuntu.

## 📋 Pré-requisitos

- VPS Ubuntu 20.04+ com:
  - 1 vCPU (mínimo)
  - 4GB RAM (mínimo) 
  - 50GB espaço em disco
  - Acesso root/sudo
- Domínio configurado (opcional, mas recomendado)

## 🔄 Processo de Migração

### Passo 1: Instalação Inicial
```bash
chmod +x 01-install-script.sh
./01-install-script.sh
```
**⚠️ IMPORTANTE:** Faça logout e login após este passo!

### Passo 2: Configurar Database
```bash
chmod +x 02-setup-database.sh
./02-setup-database.sh
```

### Passo 3: Configurar Supabase
```bash
chmod +x 03-setup-supabase.sh
./03-setup-supabase.sh
```
**📝 Anote as chaves geradas!**

### Passo 4: Migrar Dados
```bash
PGPASSWORD="HCC_Med_2024_Strong!" psql -h localhost -U supabase -d postgres -f 04-migrate-data.sql
```

### Passo 5: Deploy da Aplicação
```bash
chmod +x 06-deploy-app.sh
./06-deploy-app.sh
```

## 🔧 Configurações Importantes

### Senhas Padrão
- **PostgreSQL User:** `supabase`
- **PostgreSQL Password:** `HCC_Med_2024_Strong!`
- **Supabase Dashboard:** `admin` / `HCC_Admin_2024!`

### Portas Utilizadas
- **80:** Nginx (Frontend)
- **443:** HTTPS (após SSL)
- **5432:** PostgreSQL
- **8000:** Supabase API
- **3000:** Supabase Dashboard

## 🛠️ Comandos Úteis

### Gerenciar Supabase
```bash
cd ~/supabase-docker/supabase/docker

# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f

# Restart
docker-compose restart
```

### Gerenciar Nginx
```bash
# Recarregar configuração
sudo systemctl reload nginx

# Reiniciar
sudo systemctl restart nginx

# Ver logs
sudo tail -f /var/log/nginx/hcc-med-pay-flow.access.log
```

### Gerenciar PostgreSQL
```bash
# Conectar ao banco
PGPASSWORD="HCC_Med_2024_Strong!" psql -h localhost -U supabase -d postgres

# Ver status
sudo systemctl status postgresql

# Backup
pg_dump -h localhost -U supabase postgres > backup.sql
```

## 🔐 Configurar SSL (Opcional)

```bash
# Instalar certificado SSL
sudo certbot --nginx -d SEU_DOMINIO

# Renovar automaticamente
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoramento

### Verificar se tudo está rodando
```bash
# Docker containers
docker ps

# Serviços do sistema  
sudo systemctl status nginx postgresql

# Espaço em disco
df -h

# Memória
free -h

# Processos
htop
```

## 🆘 Solução de Problemas

### Supabase não inicia
```bash
cd ~/supabase-docker/supabase/docker
docker-compose logs
```

### Nginx erro 502
```bash
sudo nginx -t
sudo systemctl status nginx
```

### PostgreSQL connection refused
```bash
sudo systemctl status postgresql
sudo -u postgres psql
```

### Falta de memória
```bash
# Criar swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 📝 Próximos Passos

1. **Configurar backup automático**
2. **Configurar monitoramento (opcional)**
3. **Configurar firewall**
4. **Testar todas as funcionalidades**
5. **Migrar dados reais do Supabase atual**

## 🔄 Backup e Restore

### Backup Completo
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/hcc-med-pay-flow"

# Backup PostgreSQL
pg_dump -h localhost -U supabase postgres > $BACKUP_DIR/db_$DATE.sql

# Backup arquivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/hcc-med-pay-flow/

# Backup configurações
cp -r ~/supabase-docker/supabase/docker/.env $BACKUP_DIR/supabase_$DATE.env
```

### Restore
```bash
# Restore PostgreSQL
PGPASSWORD="HCC_Med_2024_Strong!" psql -h localhost -U supabase -d postgres < backup.sql

# Restore arquivos
tar -xzf files_backup.tar.gz -C /
```

---

**💡 Dica:** Mantenha este guia salvo para futuras manutenções!