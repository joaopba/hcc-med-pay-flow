import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API para gestores - envia PDF com mensagem em grupo
const GESTORES_API_URL = 'https://api.hcchospital.com.br/v2/api/external/6b756d45-89f7-444f-899e-68ed4e952680/group';
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

    // Criar FormData conforme Postman
    const formData = new FormData();
    
    // Adicionar mensagem
    formData.append('body', message);
    formData.append('number', phoneNumber);
    formData.append('externalKey', `gestor_nota_${Date.now()}`);
    formData.append('isClosed', 'false');

    // Se tem PDF, adicionar como arquivo
    if (pdf_base64 && pdf_filename) {
      console.log(`📎 Enviando com PDF: ${pdf_filename}`);
      
      // Converter base64 para File
      const pdfBytes = decodeBase64(pdf_base64);
      // Converter para Uint8Array padrão para garantir compatibilidade
      const pdfArray = new Uint8Array(pdfBytes);
      const pdfFile = new File([pdfArray], pdf_filename, { type: 'application/pdf' });
      
      // Adicionar arquivo ao FormData
      formData.append('media', pdfFile);
    } else {
      console.log('📤 Enviando apenas mensagem de texto');
    }

    const response = await fetch(GESTORES_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GESTORES_TOKEN}`
        // Não definir Content-Type - FormData define automaticamente com boundary
      },
      body: formData
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
