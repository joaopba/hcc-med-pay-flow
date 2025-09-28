import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ExcelImport from "@/components/ExcelImport";

interface Medico {
  id: string;
  nome: string;
  numero_whatsapp: string;
  especialidade: string;
  cpf: string;
  ativo: boolean;
}

export default function Medicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    numero_whatsapp: "",
    especialidade: "",
    cpf: "",
  });

  useEffect(() => {
    loadMedicos();
    
    // Realtime updates
    const channel = supabase
      .channel('medicos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicos' }, () => {
        loadMedicos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMedicos = async () => {
    try {
      const { data, error } = await supabase
        .from("medicos")
        .select("*")
        .order("nome");

      if (error) throw error;
      setMedicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar médicos:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    try {
      if (editingMedico) {
        const { error } = await supabase
          .from("medicos")
          .update(formData)
          .eq("id", editingMedico.id);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("medicos")
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Médico cadastrado com sucesso!",
        });
      }

      setShowDialog(false);
      setEditingMedico(null);
      setFormData({ nome: "", numero_whatsapp: "", especialidade: "", cpf: "" });
      loadMedicos();
    } catch (error) {
      console.error("Erro ao salvar médico:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar médico",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (medico: Medico) => {
    setEditingMedico(medico);
    setFormData({
      nome: medico.nome,
      numero_whatsapp: medico.numero_whatsapp,
      especialidade: medico.especialidade || "",
      cpf: medico.cpf || "",
    });
    setShowDialog(true);
  };

  const toggleStatus = async (medico: Medico) => {
    try {
      const { error } = await supabase
        .from("medicos")
        .update({ ativo: !medico.ativo })
        .eq("id", medico.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Médico ${!medico.ativo ? "ativado" : "desativado"} com sucesso!`,
      });

      loadMedicos();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status do médico",
        variant: "destructive",
      });
    }
  };

  const handleExcelImport = async (data: any[]) => {
    try {
      const medicosData = data.map(row => ({
        nome: row.nome || row.Nome,
        numero_whatsapp: row.numero_whatsapp || row.WhatsApp || row.whatsapp,
        especialidade: row.especialidade || row.Especialidade || "",
        cpf: row.cpf || row.CPF || ""
      }));

      const { error } = await supabase
        .from("medicos")
        .insert(medicosData);

      if (error) throw error;

      setShowImportDialog(false);
      await loadMedicos();
    } catch (error) {
      console.error("Erro ao importar médicos:", error);
      throw error;
    }
  };

  const getTemplateData = () => [
    {
      nome: "Dr. João Silva",
      numero_whatsapp: "5511999999999",
      especialidade: "Cardiologia",
      cpf: "12345678901"
    },
    {
      nome: "Dra. Maria Santos",
      numero_whatsapp: "5511888888888", 
      especialidade: "Pediatria",
      cpf: "98765432100"
    }
  ];

  const filteredMedicos = medicos.filter((medico) =>
    medico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    medico.especialidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout title="Médicos" subtitle="Gerenciar cadastro de médicos do hospital">
      <div className="p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-2">
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Médicos via Excel</DialogTitle>
                </DialogHeader>
                <ExcelImport
                  onImport={handleExcelImport}
                  templateData={getTemplateData()}
                  templateFilename="modelo-medicos.xlsx"
                  expectedColumns={["nome", "numero_whatsapp", "cpf"]}
                  title="Importação de Médicos"
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingMedico(null);
                  setFormData({ nome: "", numero_whatsapp: "", especialidade: "", cpf: "" });
                }} className="btn-gradient-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Médico
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMedico ? "Editar Médico" : "Novo Médico"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_whatsapp">Número WhatsApp</Label>
                  <Input
                    id="numero_whatsapp"
                    value={formData.numero_whatsapp}
                    onChange={(e) => setFormData({ ...formData, numero_whatsapp: e.target.value })}
                    placeholder="5511999999999"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                    placeholder="00000000000"
                    maxLength={11}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : (editingMedico ? "Atualizar" : "Salvar")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="card-professional table-professional">
          <div className="table-header-professional p-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar médicos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm bg-transparent border-0 focus:ring-0"
              />
            </div>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-poppins font-semibold">Nome</TableHead>
                  <TableHead className="font-poppins font-semibold">CPF</TableHead>
                  <TableHead className="font-poppins font-semibold">WhatsApp</TableHead>
                  <TableHead className="font-poppins font-semibold">Especialidade</TableHead>
                  <TableHead className="font-poppins font-semibold">Status</TableHead>
                  <TableHead className="font-poppins font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicos.map((medico) => (
                  <TableRow key={medico.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{medico.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{medico.cpf || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{medico.numero_whatsapp}</TableCell>
                    <TableCell className="text-muted-foreground">{medico.especialidade || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={medico.ativo ? "default" : "secondary"}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => toggleStatus(medico)}
                      >
                        {medico.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(medico)}
                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}