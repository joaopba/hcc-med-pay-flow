import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API para gestores - envia PDF com links de aprovar/rejeitar
const GESTORES_API_URL = 'https://api.hcchospital.com.br/v2/api/external/f2fe5527-b359-4b70-95d5-935b8e6674de';
const GESTORES_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjo0LCJpYXQiOjE3NjAxMjEwMjUsImV4cCI6MTgyMzE5MzAyNX0.Orgp1-GE1XncbiDih8SwLqnnwkyJmrL42FfKkUWt8OU';

interface GestorRequest {
  phoneNumber: string;
  message: string;
  pdf_base64?: string;
  pdf_filename?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message, pdf_base64, pdf_filename }: GestorRequest = await req.json();

    console.log('📧 Enviando notificação para gestor:', phoneNumber);

    // Gestores sempre recebem via nova API com token Bearer
    const payload: any = {
      number: phoneNumber,
    };

    if (pdf_base64 && pdf_filename) {
      console.log(`📎 Enviando com PDF: ${pdf_filename}`);
      payload.caption = message;
      payload.mediaBase64 = pdf_base64;
      payload.filename = pdf_filename;
    } else {
      console.log('📤 Enviando mensagem de texto');
      payload.text = message;
    }

    const response = await fetch(GESTORES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GESTORES_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    console.log('✅ Status da resposta:', response.status);

    const contentType = response.headers.get('content-type');
    let responseData: any;
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      const textResponse = await response.text();
      console.error('Resposta não é JSON:', textResponse.substring(0, 500));
      throw new Error(`API retornou resposta não-JSON (${response.status})`);
    }
    
    console.log('📊 Resposta da API:', responseData);

    // Ignorar erros de contato duplicado
    const isDuplicateContactError = responseData.message && 
      (responseData.message.includes('SequelizeUniqueConstraintError') ||
       responseData.message.includes('contacts_number_tenantid'));
    
    const hasError = !response.ok || 
                     responseData.error || 
                     (responseData.message && (
                       responseData.message.includes('error') ||
                       responseData.message.includes('Error') ||
                       responseData.message.toLowerCase().includes('sent error')
                     ));
    
    if (hasError && !isDuplicateContactError) {
      const errorMsg = responseData.message || responseData.error || JSON.stringify(responseData);
      console.error('❌ Erro ao enviar mensagem:', errorMsg);
      throw new Error(`Erro ao enviar WhatsApp (${response.status}): ${errorMsg}`);
    }
    
    if (isDuplicateContactError) {
      console.warn('⚠️ Aviso: API retornou erro de contato duplicado, mas mensagem foi enviada');
    }

    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      message: 'Notificação enviada para gestor com sucesso'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('❌ Erro no envio:', error);
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
