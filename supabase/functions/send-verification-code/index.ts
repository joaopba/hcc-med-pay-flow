import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  cpf: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf }: RequestBody = await req.json();
    
    if (!cpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cpfNumeros = cpf.replace(/\D/g, '');

    // Buscar médico ativo
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .eq('ativo', true)
      .eq('documento', cpfNumeros)
      .maybeSingle();

    if (medicoError) throw medicoError;
    
    if (!medico) {
      return new Response(
        JSON.stringify({ error: 'Médico não encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Buscar configurações da empresa
    const { data: config, error: configError } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('empresa_id', medico.empresa_id)
      .single();

    if (configError) throw configError;

    // Verificar se a verificação está habilitada
    if (!config.verificacao_medico_habilitada) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          verificacaoNecessaria: false,
          message: 'Verificação não está habilitada' 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Gerar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvar código no banco com expiração de 10 minutos
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: insertError } = await supabase
      .from('verificacao_medico')
      .insert({
        medico_id: medico.id,
        codigo,
        expires_at: expiresAt.toISOString(),
        verificado: false
      });

    if (insertError) throw insertError;

    // Preparar números de telefone com mascaramento (LGPD)
    const telefones = [];
    const numerosParaEnviar: string[] = [];

    const normalizeNumber = (raw: string) => {
      let n = (raw || '').replace(/\D/g, '');
      if (n.startsWith('00')) n = n.slice(2); // remove prefixo internacional 00
      if (n.startsWith('+')) n = n.slice(1);
      // Se vier apenas DDD+numero (11 dígitos), prefixa 55
      if (n.length === 11 && !n.startsWith('55')) n = '55' + n;
      // Se vier 12 ou 13 dígitos sem +, mantém
      return n;
    };
    
    const maskDisplay = (normalized: string) => {
      let d = normalized;
      if (d.startsWith('55')) d = d.slice(2);
      // DDD(2) + 9(5) + 4
      return d.replace(/(\d{2})(\d{5})(\d{4}).*/, '($1) *****-$3');
    };
    
    if (medico.numero_whatsapp) {
      const normalized = normalizeNumber(medico.numero_whatsapp);
      telefones.push({ numero: maskDisplay(normalized), tipo: 'Médico' });
      numerosParaEnviar.push(normalized);
    }
    
    if (medico.numero_whatsapp_contador) {
      const normalized = normalizeNumber(medico.numero_whatsapp_contador);
      telefones.push({ numero: maskDisplay(normalized), tipo: 'Contador' });
      numerosParaEnviar.push(normalized);
    }

    // Enviar código via WhatsApp para TODOS os números
    let enviosSucesso = 0;
    
    // Enviar via API dos gestores (template)
    const apiUrl = 'https://api.hcchospital.com.br/v2/api/external/f2fe5527-b359-4b70-95d5-935b8e6674de/template';
    
    for (const numero of numerosParaEnviar) {
      try {
        // Payload no mesmo formato usado para template "nota_hcc"
        const templatePayload = {
          number: numero,
          isClosed: false,
          templateData: {
            messaging_product: "whatsapp",
            to: numero,
            type: "template",
            template: {
              name: config.verificacao_medico_template_nome || 'verificamedico',
              language: { code: "pt_BR" },
              components: [
                { 
                  type: "body", 
                  parameters: [
                    { type: "text", text: codigo }
                  ]
                }
              ]
            }
          }
        };

        console.log(`📤 Enviando código ${codigo} para ${numero}`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjo0LCJpYXQiOjE3NjAxMjEwMjUsImV4cCI6MTgyMzE5MzAyNX0.Orgp1-GE1XncbiDih8SwLqnnwkyJmrL42FfKkUWt8OU'
          },
          body: JSON.stringify(templatePayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Falha ao enviar para ${numero}:`, response.status, errorText);

          // Tentativa 2: alguns templates usam variável no HEADER
          try {
            const headerPayload = {
              number: numero,
              isClosed: false,
              templateData: {
                messaging_product: "whatsapp",
                to: numero,
                type: "template",
                template: {
                  name: config.verificacao_medico_template_nome || 'verificamedico',
                  language: { code: "pt_BR" },
                  components: [
                    { 
                      type: "header", 
                      parameters: [
                        { type: "text", text: codigo }
                      ]
                    }
                  ]
                }
              }
            };

            console.log(`🔁 Tentando novamente com parâmetro no HEADER para ${numero}`);
            const retry = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
              },
              body: JSON.stringify(headerPayload)
            });

            if (retry.ok) {
              const retryData = await retry.json();
              enviosSucesso++;
              console.log(`✅ Código ${codigo} enviado (HEADER) para ${numero}`, retryData);
            } else {
              const retryText = await retry.text();
              console.error(`❌ Segunda tentativa falhou para ${numero}:`, retry.status, retryText);
            }
          } catch (retryErr) {
            console.error(`❌ Erro na tentativa alternativa para ${numero}:`, retryErr);
          }
        } else {
          const responseData = await response.json();
          enviosSucesso++;
          console.log(`✅ Código ${codigo} enviado para ${numero}`, responseData);
        }
      } catch (error) {
        console.error(`❌ Erro ao processar envio para ${numero}:`, error);
      }
    }

    console.log(`📱 Total de envios bem-sucedidos: ${enviosSucesso}/${numerosParaEnviar.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        verificacaoNecessaria: true,
        telefones, // Array com {numero: mascarado, tipo: "Médico/Contador"}
        totalEnvios: enviosSucesso,
        message: `Código de verificação enviado para ${enviosSucesso} número(s)` 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('send-verification-code error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao enviar código de verificação' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});