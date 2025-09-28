#!/bin/bash

echo "🧪 Testando webhook do WhatsApp..."

# Configurações
WEBHOOK_URL="http://hcc.chatconquista.com/functions/v1/webhook-handler"
API_URL="http://hcc.chatconquista.com/api"

echo "📡 Testando conectividade básica..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "http://hcc.chatconquista.com" || echo "❌ Frontend não acessível"
curl -s -o /dev/null -w "Status: %{http_code}\n" $API_URL || echo "❌ API não acessível"

echo ""
echo "🔍 Testando webhook verification (GET request)..."
curl -X GET "$WEBHOOK_URL?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=webhook_verify_token" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "📤 Testando webhook com dados simulados..."
curl -X POST $WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "5577999999999",
                "phone_number_id": "PHONE_NUMBER_ID"
              },
              "messages": [
                {
                  "from": "5577999999999",
                  "id": "wamid.test123",
                  "timestamp": "1638360000",
                  "text": {
                    "body": "Encaminhar Nota"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "📊 Verificando logs do webhook..."
curl -s "$API_URL/rest/v1/webhook_debug_logs?select=*&order=created_at.desc&limit=5" \
  -H "apikey: $(grep VITE_SUPABASE_ANON_KEY /var/www/hcc-med-pay-flow/.env | cut -d'=' -f2)" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY /var/www/hcc-med-pay-flow/.env | cut -d'=' -f2)" | \
  python3 -m json.tool 2>/dev/null || echo "❌ Erro ao acessar logs"

echo ""
echo "📋 Verificando configurações..."
curl -s "$API_URL/rest/v1/configuracoes?select=*&limit=1" \
  -H "apikey: $(grep VITE_SUPABASE_ANON_KEY /var/www/hcc-med-pay-flow/.env | cut -d'=' -f2)" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY /var/www/hcc-med-pay-flow/.env | cut -d'=' -f2)" | \
  python3 -m json.tool 2>/dev/null || echo "❌ Erro ao acessar configurações"

echo ""
echo "✅ Teste do webhook concluído!"