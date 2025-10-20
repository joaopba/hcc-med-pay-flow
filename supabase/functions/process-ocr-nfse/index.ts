import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseBR(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[^\d,\.]/g, '').trim();
  if (/,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(cleaned.replace(',', '.')) || 0;
}

function calcularValorLiquido(result: any) {
  const bruto = parseBR(result.totalValue);
  const inss = parseBR(result.INSSRetention ?? result.INSSvalue ?? result.INSS ?? 0);
  const irrf = parseBR(result.IRRFvalue ?? result.IRRF ?? result.IR ?? 0);
  const csll = parseBR(result.CSLLvalue ?? 0);
  const cofins = parseBR(result.COFINSvalue ?? 0);
  const pis = parseBR(result.PISvalue ?? 0);
  const desconto = parseBR(result.inconditionalDiscount ?? 0);
  const outras = parseBR(result.totalDeductions ?? 0);
  const issRetido = (result.ISSretain === 'Sim' || result.ISSretain === true) ? parseBR(result.ISSvalue) : 0;
  const liquido = bruto - (inss + irrf + csll + cofins + pis + issRetido + desconto + outras);
  const arredondado = Math.round((liquido + Number.EPSILON) * 100) / 100;

  return {
    numeroNota: result.invoiceNumber ?? null,
    valorBruto: bruto,
    valorLiquido: arredondado,
    issRetido: result.ISSretain === 'Sim' || result.ISSretain === true,
    retencoes: { INSS: inss, IRRF: irrf, CSLL: csll, COFINS: cofins, PIS: pis, ISS: issRetido, descontoIncondicional: desconto, outrasDeducoes: outras }
  };
}

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

    const { pdfData } = await req.json();

    if (!pdfData) {
      return new Response(JSON.stringify({ success: false, error: 'PDF não fornecido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar API key do banco
    const { data: config } = await supabase.from('configuracoes').select('ocr_nfse_api_key').single();
    
    if (!config?.ocr_nfse_api_key) {
      return new Response(JSON.stringify({ success: false, error: 'API key OCR não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

    const formData = new FormData();
    // A API espera o campo "invoices" no multipart
    formData.append('invoices', pdfBlob, 'nota.pdf');

    // Timeout de 60s para APIs que demoram
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Tentar primeiro o endpoint padrão; se falhar com 404/400, tentar o alternativo
    const primaryUrl = 'https://ocr.api.shelf.evtit.com/v1/external/nfse/map';
    const fallbackUrl = 'https://ocr.api.shelf.evtit.com/v1/external/v1/external/nfse/map';

    let ocrResponse = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-api-key': config.ocr_nfse_api_key
      },
      body: formData,
      signal: controller.signal
    });

    if (!ocrResponse.ok && (ocrResponse.status === 404 || ocrResponse.status === 400)) {
      // tenta fallback
      ocrResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'x-api-key': config.ocr_nfse_api_key
        },
        body: formData,
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      return new Response(JSON.stringify({ success: false, error: `Erro API OCR: ${ocrResponse.status}`, details: errorText }), {
        status: ocrResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ocrResult = await ocrResponse.json();

    if (!ocrResult.invoicesResult || ocrResult.invoicesResult.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Nota não encontrada no PDF' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const invoice = ocrResult.invoicesResult[0];
    if (invoice.errors?.length > 0) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao processar nota', details: invoice.errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const dadosCalculados = calcularValorLiquido(invoice.result);

    return new Response(JSON.stringify({ 
      success: true,
      numeroNota: dadosCalculados.numeroNota,
      valorBruto: dadosCalculados.valorBruto,
      valorLiquido: dadosCalculados.valorLiquido,
      issRetido: dadosCalculados.issRetido,
      retencoes: dadosCalculados.retencoes
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
