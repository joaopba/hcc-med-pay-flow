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

    // Preparar números de telefone com mascaramento
    const telefones = [];
    if (medico.numero_whatsapp) {
      const masked = medico.numero_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '$1*****$3');
      telefones.push(masked);
    }
    if (medico.numero_whatsapp_contador) {
      const masked = medico.numero_whatsapp_contador.replace(/(\d{2})(\d{5})(\d{4})/, '$1*****$3');
      telefones.push(masked);
    }

    // Enviar código via WhatsApp para os números do médico
    const numerosParaEnviar = [medico.numero_whatsapp, medico.numero_whatsapp_contador].filter(Boolean);
    
    for (const numero of numerosParaEnviar) {
      try {
        const payload = {
          numero_destino: numero,
          tipo_mensagem: 'template',
          payload: {
            template_nome: config.verificacao_medico_template_nome || 'verificamedico',
            parametros: [codigo]
          }
        };

        // Adicionar à fila do WhatsApp
        await supabase.from('whatsapp_queue').insert({
          numero_destino: numero,
          tipo_mensagem: 'template',
          payload,
          prioridade: 1,
          status: 'pendente',
          proximo_envio: new Date().toISOString()
        });

        console.log(`Código de verificação ${codigo} enviado para ${numero}`);
      } catch (error) {
        console.error(`Erro ao enviar para ${numero}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        verificacaoNecessaria: true,
        telefones,
        message: 'Código de verificação enviado' 
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