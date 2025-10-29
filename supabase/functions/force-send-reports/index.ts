import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Iniciando envio FORÇADO de relatórios diários');

    // Buscar configurações
    const { data: config } = await supabase
      .from('configuracoes')
      .select('*')
      .single();

    if (!config) {
      throw new Error('Configurações não encontradas');
    }

    // Buscar todos os gestores com WhatsApp
    const { data: gestores } = await supabase
      .from('profiles')
      .select('id, name, email, numero_whatsapp, whatsapp_notifications_enabled, empresa_id')
      .eq('role', 'gestor')
      .eq('whatsapp_notifications_enabled', true)
      .not('numero_whatsapp', 'is', null);

    if (!gestores || gestores.length === 0) {
      console.log('⚠️ Nenhum gestor com WhatsApp habilitado');
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhum gestor encontrado' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`📋 Encontrados ${gestores.length} gestores`);

    let enviosRealizados = 0;
    let erros = 0;

    for (const gestor of gestores) {
      try {
        // Buscar estatísticas para o relatório
        const { data: pagamentosPendentes } = await supabase
          .from('pagamentos')
          .select('id, mes_competencia, medico_id, medicos!inner(nome)')
          .eq('empresa_id', gestor.empresa_id)
          .in('status', ['pendente', 'solicitado'])
          .order('created_at', { ascending: false });

        const { data: notasPendentes } = await supabase
          .from('notas_medicos')
          .select('id, medico_id, medicos!inner(nome, empresa_id)')
          .eq('status', 'pendente')
          .eq('medicos.empresa_id', gestor.empresa_id);

        const totalPendentes = (pagamentosPendentes?.length || 0) + (notasPendentes?.length || 0);

        if (totalPendentes === 0) {
          console.log(`✅ Gestor ${gestor.name}: Nenhuma pendência`);
          continue;
        }

        // Montar mensagem do relatório
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        let mensagem = `📊 *RELATÓRIO DIÁRIO - ${dataHoje}*\n\n`;
        mensagem += `👋 Olá, ${gestor.name}!\n\n`;
        mensagem += `📌 *Resumo de Pendências:*\n`;
        mensagem += `• Total de itens pendentes: *${totalPendentes}*\n\n`;

        if (pagamentosPendentes && pagamentosPendentes.length > 0) {
          mensagem += `💰 *Pagamentos Aguardando Nota:* ${pagamentosPendentes.length}\n`;
        }

        if (notasPendentes && notasPendentes.length > 0) {
          mensagem += `📄 *Notas Aguardando Aprovação:* ${notasPendentes.length}\n`;
        }

        mensagem += `\n⚠️ *Ação Necessária:* Acesse o sistema para processar as pendências.\n`;
        mensagem += `\n_Relatório gerado automaticamente pelo sistema_`;

        // Enviar via WhatsApp diretamente para a API
        try {
          const response = await fetch(`${config.api_url}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.auth_token}`
            },
            body: JSON.stringify({
              number: gestor.numero_whatsapp,
              body: mensagem,
              externalKey: `relatorio_diario_${gestor.id}_${Date.now()}`,
              isClosed: false
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro ao enviar para ${gestor.name}:`, errorText);
            erros++;
          } else {
            console.log(`✅ Relatório enviado para ${gestor.name} (${gestor.numero_whatsapp})`);
            enviosRealizados++;
          }
        } catch (fetchError) {
          console.error(`❌ Erro ao enviar para ${gestor.name}:`, fetchError);
          erros++;
        }

        // Aguardar 2 segundos entre envios para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Erro ao processar gestor ${gestor.name}:`, error);
        erros++;
      }
    }

    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      gestoresProcessados: gestores.length,
      enviosRealizados,
      erros,
      message: `Relatórios processados: ${enviosRealizados} enviados, ${erros} erros`
    };

    console.log('📊 Resultado final:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao enviar relatórios' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});