import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody { cpf: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf }: RequestBody = await req.json();
    if (!cpf) {
      return new Response(JSON.stringify({ error: 'CPF é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cpfNumeros = cpf.replace(/\D/g, '');

    // Buscar médico ativo por CPF
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .eq('ativo', true)
      .eq('cpf', cpfNumeros)
      .maybeSingle();

    if (medicoError) throw medicoError;
    if (!medico) {
      return new Response(JSON.stringify({ medico: null }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Pagamentos do médico com notas associadas
    const { data: pagamentos, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select(`*, notas_medicos!left ( id, status, arquivo_url, created_at )`)
      .eq('medico_id', medico.id)
      .order('mes_competencia', { ascending: false });

    if (pagamentosError) throw pagamentosError;

    // Notas do médico com dados de pagamentos
    const { data: notas, error: notasError } = await supabase
      .from('notas_medicos')
      .select(`*, pagamentos!inner ( valor, mes_competencia )`)
      .eq('medico_id', medico.id)
      .order('created_at', { ascending: false });

    if (notasError) throw notasError;

    return new Response(JSON.stringify({ medico, pagamentos, notas }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('get-medico-dados error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});