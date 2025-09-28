import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUp, Upload, Check, X, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Pagamento {
  id: string;
  mes_competencia: string;
  valor: number;
  status: string;
  nota_anexada?: {
    id: string;
    status: string;
    nome_arquivo: string;
    observacoes: string;
    created_at: string;
    arquivo_url: string;
  };
}

export default function NotasMedicos() {
  const [cpf, setCpf] = useState("");
  const [medico, setMedico] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .substr(0, 14);
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
  };

  const buscarPagamentos = async () => {
    if (!cpf || cpf.length < 14) {
      toast({
        title: "Erro",
        description: "Digite um CPF válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Buscar médico pelo CPF
      const cpfNumeros = cpf.replace(/\D/g, '');
      const { data: medicoData, error: medicoError } = await supabase
        .from("medicos")
        .select("*")
        .eq("cpf", cpfNumeros)
        .eq("ativo", true)
        .single();

      if (medicoError || !medicoData) {
        toast({
          title: "CPF não encontrado",
          description: "Não encontramos um médico ativo com este CPF",
          variant: "destructive",
        });
        return;
      }

      setMedico(medicoData);

      // Buscar pagamentos pendentes/solicitados
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from("pagamentos")
        .select(`
          *,
          notas_medicos!left (
            id,
            status,
            nome_arquivo,
            observacoes,
            created_at
          )
        `)
        .eq("medico_id", medicoData.id)
        .in("status", ["pendente", "solicitado", "nota_recebida"])
        .order("mes_competencia", { ascending: false });

      if (pagamentosError) throw pagamentosError;

      // Processar dados para incluir informações das notas
      const pagamentosProcessados = pagamentosData?.map(p => ({
        ...p,
        nota_anexada: p.notas_medicos?.[0] || null
      })) || [];

      setPagamentos(pagamentosProcessados);

      toast({
        title: "Sucesso",
        description: `Bem-vindo, ${medicoData.nome}! ${pagamentosProcessados.length} pagamento(s) encontrado(s).`,
      });

    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
      toast({
        title: "Erro",
        description: "Falha ao buscar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (pagamentoId: string, file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    setUploading(pagamentoId);
    try {
      // Upload do arquivo
      const fileExt = 'pdf';
      const fileName = `${pagamentoId}_${Date.now()}.${fileExt}`;
      const filePath = `medicos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Registrar na tabela notas_medicos
      const { error: insertError } = await supabase
        .from("notas_medicos")
        .insert({
          medico_id: medico.id,
          pagamento_id: pagamentoId,
          arquivo_url: filePath,
          nome_arquivo: file.name,
          status: 'pendente'
        });

      if (insertError) {
        // Se der erro, remover o arquivo do storage
        await supabase.storage.from('notas').remove([filePath]);
        throw insertError;
      }

      toast({
        title: "Sucesso",
        description: "Nota fiscal enviada com sucesso! Aguarde a análise.",
      });

      // Recarregar dados
      buscarPagamentos();

    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha no upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const removerNota = async (pagamentoId: string, arquivoUrl: string) => {
    try {
      // Remover registro da tabela
      const { error: deleteError } = await supabase
        .from("notas_medicos")
        .delete()
        .eq("pagamento_id", pagamentoId);

      if (deleteError) throw deleteError;

      // Remover arquivo do storage
      await supabase.storage.from('notas').remove([arquivoUrl]);

      toast({
        title: "Sucesso",
        description: "Nota fiscal removida com sucesso",
      });

      buscarPagamentos();
    } catch (error) {
      console.error("Erro ao remover nota:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover nota fiscal",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-6 w-6" />
              Portal do Médico - Envio de Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCPFChange}
                  maxLength={14}
                />
              </div>
              <Button onClick={buscarPagamentos} disabled={loading}>
                {loading ? "Buscando..." : "Buscar Pagamentos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {medico && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Olá, {medico.nome}!</CardTitle>
              <p className="text-muted-foreground">
                Aqui estão seus pagamentos pendentes de documentação:
              </p>
            </CardHeader>
          </Card>
        )}

        {pagamentos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nota Fiscal</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((pagamento) => (
                    <TableRow key={pagamento.id}>
                      <TableCell>
                        {new Date(pagamento.mes_competencia + '-01').toLocaleDateString('pt-BR', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </TableCell>
                      <TableCell>{formatCurrency(pagamento.valor)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pagamento.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {pagamento.nota_anexada ? (
                          <div className="space-y-2">
                            {getStatusBadge(pagamento.nota_anexada.status)}
                            <p className="text-sm text-muted-foreground">
                              {pagamento.nota_anexada.nome_arquivo}
                            </p>
                            {pagamento.nota_anexada.observacoes && (
                              <p className="text-sm text-red-600">
                                {pagamento.nota_anexada.observacoes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Pendente envio</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!pagamento.nota_anexada ? (
                          <div>
                            <Input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(pagamento.id, file);
                                }
                              }}
                              disabled={uploading === pagamento.id}
                              className="hidden"
                              id={`file-${pagamento.id}`}
                            />
                            <Label htmlFor={`file-${pagamento.id}`} className="cursor-pointer">
                              <Button asChild disabled={uploading === pagamento.id}>
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  {uploading === pagamento.id ? "Enviando..." : "Enviar PDF"}
                                </span>
                              </Button>
                            </Label>
                          </div>
                        ) : pagamento.nota_anexada.status === 'pendente' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removerNota(pagamento.id, pagamento.nota_anexada!.arquivo_url)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {medico && pagamentos.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum pagamento pendente de documentação encontrado.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}