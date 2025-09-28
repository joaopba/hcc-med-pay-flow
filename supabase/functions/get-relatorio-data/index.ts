import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let query = supabase
      .from('pagamentos')
      .select(`
        id,
        mes_competencia,
        valor,
        valor_liquido,
        status,
        data_pagamento,
        created_at,
        medicos(
          nome,
          cpf,
          especialidade
        )
      `)
      .order('created_at', { ascending: false });

    // Filtros de data se fornecidos
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: pagamentos, error } = await query;

    if (error) throw error;

    // Processar e formatar dados para o relatório
    const relatorioData = (pagamentos || []).map((pagamento: any) => {
      const medico = Array.isArray(pagamento.medicos) ? pagamento.medicos[0] : pagamento.medicos;
      return {
        id: pagamento.id,
        medico_nome: medico?.nome || 'N/A',
        medico_cpf: medico?.cpf || 'N/A',
        especialidade: medico?.especialidade || 'N/A',
        mes_competencia: pagamento.mes_competencia,
        valor_bruto: pagamento.valor,
        valor_liquido: pagamento.valor_liquido || pagamento.valor,
        status: pagamento.status,
        data_pagamento: pagamento.data_pagamento,
        data_criacao: pagamento.created_at
      };
    });

    // Calcular totais
    const totalBruto = relatorioData.reduce((sum, item) => sum + (item.valor_bruto || 0), 0);
    const totalLiquido = relatorioData.reduce((sum, item) => sum + (item.valor_liquido || 0), 0);
    const totalPagamentos = relatorioData.length;
    const pagamentosPagos = relatorioData.filter(item => item.status === 'pago').length;

    return new Response(JSON.stringify({
      success: true,
      data: relatorioData,
      summary: {
        total_pagamentos: totalPagamentos,
        pagamentos_pagos: pagamentosPagos,
        valor_total_bruto: totalBruto,
        valor_total_liquido: totalLiquido,
        periodo: {
          inicio: startDate || 'início',
          fim: endDate || 'fim'
        }
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Erro ao buscar dados do relatório:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
});