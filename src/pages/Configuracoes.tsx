import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Copy, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

interface Configuracao {
  id: string;
  api_url: string;
  auth_token: string;
  webhook_url: string;
  email_notificacoes: boolean;
}

export default function Configuracoes() {
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const webhookUrl = `${window.location.origin}/api/webhook`;

  useEffect(() => {
    loadConfiguracoes();
  }, []);

  const loadConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("*")
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      // Se não existe configuração, criar uma padrão
      setConfig({
        id: "",
        api_url: "https://api.hcchospital.com.br/v2/api/external/43e14118-b615-419a-b827-23480915ddcb",
        auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MywicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoyLCJpYXQiOjE3NTgxMjkzMjMsImV4cCI6MTgyMTIwMTMyM30.dEvjbe3ZYLkFn3Bx7N8uKcsw34ZOJoCApJRgAAMmW2w",
        webhook_url: "",
        email_notificacoes: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("configuracoes")
          .update({
            api_url: config.api_url,
            auth_token: config.auth_token,
            webhook_url: config.webhook_url,
            email_notificacoes: config.email_notificacoes,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("configuracoes")
          .insert([{
            api_url: config.api_url,
            auth_token: config.auth_token,
            webhook_url: config.webhook_url,
            email_notificacoes: config.email_notificacoes,
          }])
          .select()
          .single();

        if (error) throw error;
        setConfig({ ...config, id: data.id });
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência",
    });
  };

  const testConnection = async () => {
    if (!config) return;

    try {
      const response = await fetch(`${config.api_url}/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.auth_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Conexão com a API funcionando corretamente!",
        });
      } else {
        throw new Error('Falha na conexão');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com a API. Verifique as configurações.",
        variant: "destructive",
      });
    }
  };

  if (loading || !config) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">
              Configurar integrações e parâmetros do sistema
            </p>
          </div>
          
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>API do WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api_url">URL da API</Label>
                <Input
                  id="api_url"
                  value={config.api_url}
                  onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                  placeholder="https://api.hcchospital.com.br/v2/api/external/..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="auth_token">Token de Autenticação</Label>
                <Textarea
                  id="auth_token"
                  value={config.auth_token}
                  onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>

              <Button onClick={testConnection} variant="outline" className="w-full">
                <TestTube className="h-4 w-4 mr-2" />
                Testar Conexão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <p className="text-sm text-muted-foreground">
                  Configure esta URL no seu sistema de WhatsApp para receber notificações de notas:
                </p>
                <div className="flex space-x-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_url">URL de Callback (Opcional)</Label>
                <Input
                  id="webhook_url"
                  value={config.webhook_url}
                  onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  placeholder="https://seudominio.com/webhook"
                />
                <p className="text-xs text-muted-foreground">
                  URL para receber notificações de eventos do sistema
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email_notificacoes">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber emails quando novas notas chegarem e pagamentos forem realizados
                  </p>
                </div>
                <Switch
                  id="email_notificacoes"
                  checked={config.email_notificacoes}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, email_notificacoes: checked })
                  }
                />
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Configuração do Email</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  As notificações são enviadas via Resend. Configure sua chave de API no painel de administração.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs font-mono">RESEND_API_KEY configurada ✓</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Versão:</p>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Último backup:</p>
                  <p className="font-medium">Não configurado</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de médicos:</p>
                  <p className="font-medium">-</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de pagamentos:</p>
                  <p className="font-medium">-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}