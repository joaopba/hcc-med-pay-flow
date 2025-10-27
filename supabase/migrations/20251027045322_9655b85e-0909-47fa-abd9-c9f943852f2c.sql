-- Adicionar campos de configuração de APIs WhatsApp e modo de manutenção
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS modo_manutencao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meta_api_url TEXT DEFAULT 'https://graph.facebook.com/v21.0/468233466375447/messages',
ADD COLUMN IF NOT EXISTS meta_token TEXT DEFAULT 'EAAXSNrvzpbABP7jYQp5lgOw48kSOA5UugXYTs2ZBExZBrDtaC1wUr3tCfZATZBT9SAqmGpZA1pAucXVRa8kZC7trtip0rHAERY0ZAcZA6MkxDsosyCI8O35g0mmBpBuoB8lqihDPvhjsmKz6madZCARKbVW5ihUZCWZCmiND50zARf1Tk58ZAuIlzZAfJ9IzHZCXIZC5QZDZD',
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT DEFAULT '468233466375447',
ADD COLUMN IF NOT EXISTS meta_waba_id TEXT DEFAULT '421395757718205',
ADD COLUMN IF NOT EXISTS template_nome TEXT DEFAULT 'nota_hcc',
ADD COLUMN IF NOT EXISTS text_api_url TEXT DEFAULT 'https://auto.hcchospital.com.br/message/sendText/inovação',
ADD COLUMN IF NOT EXISTS text_api_key TEXT DEFAULT 'BA6138D0B74C-4AED-8E91-8B3B2C337811',
ADD COLUMN IF NOT EXISTS media_api_url TEXT DEFAULT 'https://auto.hcchospital.com.br/message/sendMedia/inovação',
ADD COLUMN IF NOT EXISTS media_api_key TEXT DEFAULT 'BA6138D0B74C-4AED-8E91-8B3B2C337811',
ADD COLUMN IF NOT EXISTS mensagem_manutencao TEXT DEFAULT 'Sistema em manutenção. Voltaremos em breve.';