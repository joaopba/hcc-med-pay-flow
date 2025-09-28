# 📡 Configuração DNS

## Configurar no seu provedor DNS:

### Registro A
- **Nome:** `hcc` (ou `@` se for subdomínio)
- **Tipo:** A
- **Valor:** `72.60.157.200`
- **TTL:** 300 (5 minutos)

### Teste DNS
```bash
# Testar se o DNS está funcionando
dig hcc.chatconquista.com

# Ou usar nslookup
nslookup hcc.chatconquista.com
```

## Após configurar DNS:
1. Aguarde propagação (5-30 minutos)
2. Execute os scripts de migração
3. Configure SSL: `sudo certbot --nginx -d hcc.chatconquista.com`

## URLs finais:
- **Frontend:** https://hcc.chatconquista.com
- **API Supabase:** https://hcc.chatconquista.com/api
- **Dashboard Supabase:** https://hcc.chatconquista.com/dashboard