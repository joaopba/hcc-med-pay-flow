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
    const numerosParaEnviar = [];
    
    if (medico.numero_whatsapp) {
      const numeroLimpo = medico.numero_whatsapp.replace(/\D/g, '');
      const masked = numeroLimpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
      telefones.push({ numero: masked, tipo: 'Médico' });
      numerosParaEnviar.push(numeroLimpo);
    }
    
    if (medico.numero_whatsapp_contador) {
      const numeroLimpo = medico.numero_whatsapp_contador.replace(/\D/g, '');
      const masked = numeroLimpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
      telefones.push({ numero: masked, tipo: 'Contador' });
      numerosParaEnviar.push(numeroLimpo);
    }

    // Enviar código via WhatsApp para TODOS os números
    let enviosSucesso = 0;
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

        // Adicionar à fila do WhatsApp com prioridade alta
        const { error: queueError } = await supabase.from('whatsapp_queue').insert({
          numero_destino: numero,
          tipo_mensagem: 'template',
          payload,
          prioridade: 1, // Alta prioridade
          status: 'pendente',
          proximo_envio: new Date().toISOString()
        });

        if (queueError) {
          console.error(`Erro ao adicionar à fila para ${numero}:`, queueError);
        } else {
          enviosSucesso++;
          console.log(`✅ Código ${codigo} adicionado à fila para ${numero}`);
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