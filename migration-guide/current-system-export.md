# 📊 Configurações Atuais do Sistema

## 🔑 Dados para Migração

### Configurações Supabase Atuais
- **Project ID:** nnytrkgsjajsecotasqv
- **URL:** https://nnytrkgsjajsecotasqv.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueXRya2dzamFqc2Vjb3Rhc3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjE3ODUsImV4cCI6MjA3NDU5Nzc4NX0.jWnvKQ-N378S_9KCBT_iNCvt51B1FrwX0Xcu6AJnsb4

### 📦 Edge Functions para Migrar
1. **send-whatsapp-template** - Envio de mensagens WhatsApp
2. **get-medico-dados** - Obter dados do médico por CPF
3. **webhook-handler** - Handler para webhooks
4. **get-relatorio-data** - Dados para relatórios
5. **send-email-notification** - Notificações por email
6. **send-notification** - Sistema de notificações

### 💾 Storage Buckets
1. **notas** - Armazenamento de notas fiscais (privado)
2. **comprovantes** - Comprovantes de pagamento (privado)

### 🔐 Secrets Configurados
- RESEND_API_KEY
- SMTP_PASSWORD, SMTP_HOST, SMTP_PORT, SMTP_USER
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL, SUPABASE_PUBLISHABLE_KEY

## 🚚 Script para Exportar Dados Reais

```bash
#!/bin/bash
# Execute este script no seu ambiente atual para exportar dados

# Conectar ao Supabase atual e exportar dados
echo "Exportando dados das tabelas principais..."

# Você precisará usar o Supabase CLI ou interface web para:
# 1. Exportar dados das tabelas: medicos, pagamentos, notas_medicos, configuracoes
# 2. Fazer backup dos arquivos nos buckets: notas, comprovantes
# 3. Anotar as configurações atuais dos edge functions

echo "📝 IMPORTANTE: Antes de migrar, faça backup de:"
echo "   - Todos os dados das tabelas"
echo "   - Arquivos dos buckets de storage"
echo "   - Configurações dos edge functions"
echo "   - Secrets e variáveis de ambiente"
```

## 🔄 Checklist de Migração

### Antes da Migração
- [ ] Fazer backup completo dos dados atuais
- [ ] Anotar todas as configurações de API
- [ ] Backup dos arquivos de storage
- [ ] Testar acesso à VPS

### Durante a Migração
- [ ] Executar scripts de instalação na ordem correta
- [ ] Configurar domínio/IP no Nginx
- [ ] Importar dados reais exportados
- [ ] Configurar edge functions
- [ ] Testar todas as funcionalidades

### Após a Migração
- [ ] Configurar SSL
- [ ] Configurar backup automático
- [ ] Monitorar performance
- [ ] Atualizar DNS (se aplicável)

## 🎯 Próximos Passos na VPS

1. Execute os scripts na ordem: 01 → 02 → 03 → 04 → 06
2. Configure seu domínio no arquivo nginx
3. Importe seus dados reais
4. Configure as edge functions com os mesmos secrets
5. Teste tudo antes de apontar o domínio

---

**⚠️ IMPORTANTE:** Este sistema atual será migrado completamente para sua VPS, mantendo todas as funcionalidades.