import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converte valores monetários brasileiros (ex: "3.578,72" ou "3578.72") em número.
 */
function parseBR(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  // Remove tudo que não for número, vírgula ou ponto
  const cleaned = value.replace(/[^\d,\.]/g, '').trim();

  // Formato padrão BR (com vírgula nos centavos)
  if (/,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Caso venha formato internacional (ex: 3578.72)
  return parseFloat(cleaned.replace(',', '.')) || 0;
}

/**
 * Calcula o valor líquido de uma NFS-e com base nas retenções informadas.
 * Considera apenas ISS se estiver marcado como retido.
 */
function calcularValorLiquido(result: any) {
  const bruto = parseBR(result.totalValue);
  const inss = parseBR(result.INSSRetention ?? result.INSSvalue ?? result.INSS ?? 0);
  const irrf = parseBR(result.IRRFvalue ?? result.IRRF ?? result.IR ?? 0);
  const csll = parseBR(result.CSLLvalue ?? 0);
  const cofins = parseBR(result.COFINSvalue ?? 0);
  const pis = parseBR(result.PISvalue ?? 0);
  const desconto = parseBR(result.inconditionalDiscount ?? 0);
  const outras = parseBR(result.totalDeductions ?? 0);

  // ISS só entra se for retido
  const issRetido = (result.ISSretain === 'Sim' || result.ISSretain === true) ? parseBR(result.ISSvalue) : 0;

  const liquido = bruto - (inss + irrf + csll + cofins + pis + issRetido + desconto + outras);
  const arredondado = Math.round((liquido + Number.EPSILON) * 100) / 100;

  // Retorna informações detalhadas para uso em API
  return {
    numeroNota: result.invoiceNumber ?? null,
    valorBruto: bruto,
    valorLiquido: arredondado,
    issRetido: result.ISSretain === 'Sim' || result.ISSretain === true,
    retencoes: {
      INSS: inss,
      IRRF: irrf,
      CSLL: csll,
      COFINS: cofins,
      PIS: pis,
      ISS: issRetido,
      descontoIncondicional: desconto,
      outrasDeducoes: outras
    }
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

    // Receber o PDF em base64 ou ArrayBuffer
    const { pdfData, apiKey } = await req.json();

    if (!pdfData || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF data e API key são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Iniciando processamento OCR NFS-e');

    // Converter base64 para Blob se necessário
    let pdfBlob: Blob;
    if (typeof pdfData === 'string') {
      // Remover prefixo data:application/pdf;base64, se existir
      const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    } else {
      pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
    }

    // Criar FormData para enviar à API de OCR
    const formData = new FormData();
    formData.append('file', pdfBlob, 'nota.pdf');

    console.log('📤 Enviando PDF para API OCR');

    // Chamar API de OCR
    const ocrResponse = await fetch(
      'https://ocr.api.shelf.evtit.com/v1/external/nfse/map',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'x-api-key': apiKey,
        },
        body: formData,
      }
    );

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('❌ Erro na API OCR:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API OCR: ${ocrResponse.status}`,
          details: errorText 
        }),
        { status: ocrResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ocrResult = await ocrResponse.json();
    console.log('✅ Resposta da API OCR recebida');

    // Extrair dados do primeiro invoice
    if (!ocrResult.invoicesResult || ocrResult.invoicesResult.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhuma nota fiscal encontrada no PDF' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoice = ocrResult.invoicesResult[0];
    
    if (invoice.errors && invoice.errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao processar nota fiscal',
          details: invoice.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = invoice.result;
    
    // Calcular valor líquido
    const dadosCalculados = calcularValorLiquido(result);

    console.log('💰 Valores calculados:', {
      numeroNota: dadosCalculados.numeroNota,
      valorBruto: dadosCalculados.valorBruto,
      valorLiquido: dadosCalculados.valorLiquido
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        numeroNota: dadosCalculados.numeroNota,
        valorBruto: dadosCalculados.valorBruto,
        valorLiquido: dadosCalculados.valorLiquido,
        issRetido: dadosCalculados.issRetido,
        retencoes: dadosCalculados.retencoes,
        ocrResultado: result  // Retornar resultado completo para referência
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no processamento OCR:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido ao processar OCR' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});