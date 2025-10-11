import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RelatorioItem {
  medico_nome: string;
  numero_whatsapp: string;
  mes_competencia: string;
  valor: number;
  valor_liquido: number;
  status: string;
  data_solicitacao: string;
  data_resposta: string;
  data_pagamento: string;
}

export default function Relatorios() {
  const [dados, setDados] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    mes_inicio: "",
    mes_fim: "",
    status: "todos",
    medico: "",
  });
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pagamentos")
        .select(`
          valor,
          valor_liquido,
          status,
          mes_competencia,
          data_solicitacao,
          data_resposta,
          data_pagamento,
          medicos (
            nome,
            numero_whatsapp
          )
        `)
        .order("mes_competencia", { ascending: false });

      // Aplicar filtros
      if (filtros.mes_inicio) {
        query = query.gte("mes_competencia", filtros.mes_inicio);
      }
      
      if (filtros.mes_fim) {
        query = query.lte("mes_competencia", filtros.mes_fim);
      }
      
      if (filtros.status !== "todos") {
        query = query.eq("status", filtros.status as any);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Transformar dados para o formato do relatório
      const dadosFormatados = data?.map(item => {
        // Função para formatar data evitando timezone
        const formatarData = (dataStr: string | null) => {
          if (!dataStr) return '';
          const data = dataStr.split('T')[0]; // Pega apenas a parte da data
          const [ano, mes, dia] = data.split('-');
          return `${dia}/${mes}/${ano}`;
        };

        return {
          medico_nome: item.medicos.nome,
          numero_whatsapp: item.medicos.numero_whatsapp,
          mes_competencia: item.mes_competencia,
          valor: item.valor,
          valor_liquido: item.valor_liquido || 0,
          status: item.status,
          data_solicitacao: formatarData(item.data_solicitacao),
          data_resposta: formatarData(item.data_resposta),
          data_pagamento: formatarData(item.data_pagamento),
        };
      }) || [];

      // Filtrar por médico se especificado
      const dadosFiltrados = filtros.medico 
        ? dadosFormatados.filter(item => 
            item.medico_nome.toLowerCase().includes(filtros.medico.toLowerCase())
          )
        : dadosFormatados;

      setDados(dadosFiltrados);
      
      toast({
        title: "Sucesso",
        description: `Relatório gerado com ${dadosFiltrados.length} registros`,
      });
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (dados.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    const headers = [
      "Médico",
      "WhatsApp",
      "Competência",
      "Valor Bruto",
      "Valor Líquido",
      "Status",
      "Data Solicitação",
      "Data Resposta",
      "Data Pagamento"
    ];

    const csvContent = [
      headers.join(","),
      ...dados.map(item => [
        `"${item.medico_nome}"`,
        `"${item.numero_whatsapp}"`,
        item.mes_competencia,
        item.valor.toFixed(2),
        item.valor_liquido.toFixed(2),
        `"${getStatusLabel(item.status)}"`,
        `"${item.data_solicitacao}"`,
        `"${item.data_resposta}"`,
        `"${item.data_pagamento}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_pagamentos_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Sucesso",
      description: "Relatório exportado com sucesso!",
    });
    
    setExporting(false);
  };

  const exportarGoogleSheets = async () => {
    try {
      // Preparar dados para Google Sheets API
      const sheetData = [
        ["Médico", "WhatsApp", "Competência", "Valor Bruto", "Valor Líquido", "Status", "Data Solicitação", "Data Resposta", "Data Pagamento"],
        ...dados.map(item => [
          item.medico_nome,
          item.numero_whatsapp,
          item.mes_competencia,
          item.valor,
          item.valor_liquido,
          getStatusLabel(item.status),
          item.data_solicitacao,
          item.data_resposta,
          item.data_pagamento
        ])
      ];

      // Chamar edge function para integração com Google Sheets
      const { data, error } = await supabase.functions.invoke('google-sheets-export', {
        body: {
          data: sheetData,
          sheetName: `Pagamentos_${new Date().toISOString().slice(0, 10)}`
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados exportados para Google Sheets!",
      });
      
      if (data?.sheetUrl) {
        window.open(data.sheetUrl, '_blank');
      }
    } catch (error) {
      console.error("Erro ao exportar para Google Sheets:", error);
      toast({
        title: "Erro",
        description: "Falha ao exportar para Google Sheets. Verifique as configurações da API.",
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente": return "Pendente";
      case "solicitado": return "Solicitado";
      case "nota_recebida": return "Nota Recebida";
      case "pago": return "Pago";
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">
              Gerar relatórios e exportar dados para análise
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="mes_inicio">Mês Início</Label>
                <Input
                  id="mes_inicio"
                  type="month"
                  value={filtros.mes_inicio}
                  onChange={(e) => setFiltros({ ...filtros, mes_inicio: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mes_fim">Mês Fim</Label>
                <Input
                  id="mes_fim"
                  type="month"
                  value={filtros.mes_fim}
                  onChange={(e) => setFiltros({ ...filtros, mes_fim: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="nota_recebida">Nota Recebida</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="medico">Médico</Label>
                <Input
                  id="medico"
                  placeholder="Nome do médico..."
                  value={filtros.medico}
                  onChange={(e) => setFiltros({ ...filtros, medico: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={gerarRelatorio} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              
              {dados.length > 0 && (
                <>
                  <Button onClick={exportarCSV} variant="outline" disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? "Exportando..." : "Exportar CSV"}
                  </Button>
                  
                  <Button onClick={exportarGoogleSheets} variant="outline">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Google Sheets
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {dados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados ({dados.length} registros)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Médico</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Data Resposta</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.medico_nome}</TableCell>
                      <TableCell>{item.mes_competencia}</TableCell>
                      <TableCell>{formatCurrency(item.valor)}</TableCell>
                      <TableCell>{formatCurrency(item.valor_liquido)}</TableCell>
                      <TableCell>{getStatusLabel(item.status)}</TableCell>
                      <TableCell>{item.data_solicitacao}</TableCell>
                      <TableCell>{item.data_resposta}</TableCell>
                      <TableCell>{item.data_pagamento}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}