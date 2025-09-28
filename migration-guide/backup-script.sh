#!/bin/bash

# Script de backup automático para HCC Med Pay Flow
# Execute via cron: 0 2 * * * /home/usuario/migration-guide/backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/hcc-med-pay-flow"
LOG_FILE="$BACKUP_DIR/backup.log"

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

echo "[$DATE] Iniciando backup..." >> $LOG_FILE

# Backup PostgreSQL
echo "[$DATE] Backup PostgreSQL..." >> $LOG_FILE
PGPASSWORD="HCC_Med_2024_Strong!" pg_dump -h localhost -U supabase postgres > $BACKUP_DIR/db_$DATE.sql
if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ Backup PostgreSQL concluído" >> $LOG_FILE
    # Comprimir backup do banco
    gzip $BACKUP_DIR/db_$DATE.sql
else
    echo "[$DATE] ❌ Erro no backup PostgreSQL" >> $LOG_FILE
fi

# Backup arquivos da aplicação
echo "[$DATE] Backup arquivos..." >> $LOG_FILE
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/hcc-med-pay-flow/ 2>/dev/null
if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ Backup arquivos concluído" >> $LOG_FILE
else
    echo "[$DATE] ❌ Erro no backup arquivos" >> $LOG_FILE
fi

# Backup configurações Supabase
echo "[$DATE] Backup configurações..." >> $LOG_FILE
cp ~/supabase-docker/supabase/docker/.env $BACKUP_DIR/supabase_$DATE.env
if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ Backup configurações concluído" >> $LOG_FILE
else
    echo "[$DATE] ❌ Erro no backup configurações" >> $LOG_FILE
fi

# Backup configurações Nginx
cp /etc/nginx/sites-available/hcc-med-pay-flow $BACKUP_DIR/nginx_$DATE.conf 2>/dev/null

# Remover backups antigos (manter apenas 7 dias)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.env" -mtime +7 -delete
find $BACKUP_DIR -name "*.conf" -mtime +7 -delete

# Verificar espaço em disco
DISK_USAGE=$(df / | grep -vE '^Filesystem' | awk '{print $5}' | sed 's/%//g')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$DATE] ⚠️ AVISO: Espaço em disco baixo ($DISK_USAGE%)" >> $LOG_FILE
fi

echo "[$DATE] Backup concluído" >> $LOG_FILE
echo "" >> $LOG_FILE

# Manter apenas últimas 30 linhas do log
tail -n 30 $LOG_FILE > $LOG_FILE.tmp && mv $LOG_FILE.tmp $LOG_FILE