import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, X, Minimize2, Maximize2, CheckCircle, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  sender_type: 'medico' | 'financeiro' | 'sistema';
  message: string;
  created_at: string;
  read: boolean;
}

interface ChatWithFinanceiroProps {
  medicoId: string;
  medicoNome: string;
  isGestor?: boolean;
  fullscreen?: boolean;
  gestorNome?: string;
  gestorId?: string;
  ticketId?: string;
  ticketStatus?: 'aberto' | 'em_atendimento' | 'finalizado';
  onTicketUpdate?: () => void;
}

export default function ChatWithFinanceiro({ 
  medicoId, 
  medicoNome, 
  isGestor = false, 
  fullscreen = false, 
  gestorNome,
  gestorId,
  ticketId,
  ticketStatus,
  onTicketUpdate 
}: ChatWithFinanceiroProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isOpen, setIsOpen] = useState(fullscreen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [currentTicketId, setCurrentTicketId] = useState(ticketId);
  const [currentTicketStatus, setCurrentTicketStatus] = useState(ticketStatus);
  const [closingTicket, setClosingTicket] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [availableGestores, setAvailableGestores] = useState<Array<{id: string; name: string}>>([]);
  const [selectedTransferGestor, setSelectedTransferGestor] = useState("");
  const [transferring, setTransferring] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    if (isOpen || fullscreen) {
      loadMessages();
      if (isGestor) {
        markAsRead();
        claimTicket();
      }
    }
  }, [isOpen, fullscreen, medicoId]);

  useEffect(() => {
    // Realtime subscription
    const channel = supabase
      .channel(`chat-${medicoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `medico_id=eq.${medicoId}`
        },
        () => {
          console.log('Nova mensagem recebida');
          loadMessages();
          if ((isOpen || fullscreen) && isGestor) {
            markAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [medicoId, isOpen, fullscreen, isGestor]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    // Notificação de nova mensagem
    if (messages.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
      const lastMessage = messages[messages.length - 1];
      const isFromOther = isGestor ? lastMessage.sender_type === 'medico' : lastMessage.sender_type === 'financeiro';
      
      if (isFromOther && (!isOpen && !fullscreen)) {
        // Notificação sonora suave
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2i68ee');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        
        // Notificação visual
        if (!document.hasFocus()) {
          try {
            new Notification('Nova mensagem', {
              body: `${isGestor ? medicoNome : gestorNome || 'Financeiro'}: ${lastMessage.message.substring(0, 50)}...`,
              icon: '/favicon.png'
            });
          } catch (e) {
            // Notificações bloqueadas
          }
        }
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, isGestor, medicoNome, gestorNome, isOpen, fullscreen]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('medico_id', medicoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);

      // Count unread messages
      const unread = data?.filter(m => 
        !m.read && m.sender_type !== (isGestor ? 'medico' : 'financeiro')
      ).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendSystemMessage = async (message: string) => {
    try {
      await supabase
        .from('chat_messages')
        .insert({
          medico_id: medicoId,
          sender_type: 'sistema',
          message: message,
        });
    } catch (error) {
      console.error('Erro ao enviar mensagem do sistema:', error);
    }
  };

  const claimTicket = async () => {
    try {
      if (!isGestor) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Verificar se já existe ticket aberto ou criar novo
      const { data: existingTicket } = await supabase
        .from('chat_tickets')
        .select('*')
        .eq('medico_id', medicoId)
        .in('status', ['aberto', 'em_atendimento'])
        .maybeSingle();

      if (existingTicket) {
        // Se ticket está aberto, assumir
        if (existingTicket.status === 'aberto') {
          const { data, error } = await supabase
            .from('chat_tickets')
            .update({
              status: 'em_atendimento',
              gestor_id: profile.id
            })
            .eq('id', existingTicket.id)
            .select()
            .single();

          if (!error && data) {
            setCurrentTicketId(data.id);
            setCurrentTicketStatus('em_atendimento');
            onTicketUpdate?.();
            
            // Enviar mensagem de saudação
            await sendSystemMessage(`🤝 ${profile.name} iniciou o atendimento. Olá Dr(a). ${medicoNome}, como posso ajudá-lo(a) hoje?`);
          }
        } else {
          // Já está em atendimento
          setCurrentTicketId(existingTicket.id);
          setCurrentTicketStatus(existingTicket.status as 'aberto' | 'em_atendimento' | 'finalizado');
        }
      } else {
        // Criar novo ticket
        const { data, error } = await supabase
          .from('chat_tickets')
          .insert({
            medico_id: medicoId,
            gestor_id: profile.id,
            status: 'em_atendimento'
          })
          .select()
          .single();

        if (!error && data) {
          setCurrentTicketId(data.id);
          setCurrentTicketStatus('em_atendimento');
          onTicketUpdate?.();
          
          // Enviar mensagem de saudação
          await sendSystemMessage(`🤝 ${profile.name} iniciou o atendimento. Olá Dr(a). ${medicoNome}, como posso ajudá-lo(a) hoje?`);
        }
      }
    } catch (error) {
      console.error('Erro ao assumir ticket:', error);
    }
  };

  const markAsRead = async () => {
    try {
      if (!isGestor) return;

      const { error } = await supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('medico_id', medicoId)
        .eq('sender_type', 'medico')
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  };

  const handleCloseTicket = async () => {
    try {
      if (!currentTicketId) return;

      setClosingTicket(true);
      
      // Enviar mensagem de encerramento
      await sendSystemMessage(`✅ Atendimento finalizado por ${gestorNome}. Obrigado pelo contato!`);
      
      const { error } = await supabase
        .from('chat_tickets')
        .update({
          status: 'finalizado',
          closed_at: new Date().toISOString()
        })
        .eq('id', currentTicketId);

      if (error) throw error;

      setCurrentTicketStatus('finalizado');
      onTicketUpdate?.();
      
      toast({
        title: "Atendimento Finalizado",
        description: "O médico será notificado para avaliar o atendimento.",
      });
    } catch (error: any) {
      console.error('Erro ao finalizar ticket:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao finalizar atendimento",
        variant: "destructive",
      });
    } finally {
      setClosingTicket(false);
    }
  };

  const loadAvailableGestores = async () => {
    try {
      const { data: gestores } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'gestor')
        .neq('id', gestorId || '');

      setAvailableGestores(gestores || []);
    } catch (error) {
      console.error('Erro ao carregar gestores:', error);
    }
  };

  const handleTransferTicket = async () => {
    if (!selectedTransferGestor || !currentTicketId) return;

    setTransferring(true);
    try {
      const newGestor = availableGestores.find(g => g.id === selectedTransferGestor);
      if (!newGestor) return;

      // Atualizar ticket
      const { error } = await supabase
        .from('chat_tickets')
        .update({ gestor_id: selectedTransferGestor })
        .eq('id', currentTicketId);

      if (error) throw error;

      // Enviar mensagem de transferência
      await sendSystemMessage(`🔄 Atendimento transferido de ${gestorNome} para ${newGestor.name}`);

      toast({
        title: "Ticket Transferido",
        description: `Atendimento transferido para ${newGestor.name}`,
      });

      setShowTransferDialog(false);
      onTicketUpdate?.();
    } catch (error: any) {
      console.error('Erro ao transferir ticket:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao transferir ticket",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (currentTicketStatus === 'finalizado') {
      toast({
        title: "Atendimento Finalizado",
        description: "Este atendimento já foi finalizado.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          medico_id: medicoId,
          sender_type: isGestor ? 'financeiro' : 'medico',
          message: newMessage.trim(),
        });

      if (error) throw error;

      // Enviar notificação WhatsApp
      if (!isGestor) {
        // Médico enviando para financeiro
        const { data: profiles } = await supabase
          .from('profiles')
          .select('numero_whatsapp, whatsapp_notifications_enabled')
          .eq('role', 'gestor')
          .eq('whatsapp_notifications_enabled', true);

        profiles?.forEach(async (profile) => {
          if (profile.numero_whatsapp) {
            await supabase.functions.invoke('send-whatsapp-template', {
              body: {
                type: 'nova_mensagem_chat',
                numero_destino: profile.numero_whatsapp,
                medico_nome: medicoNome,
                mensagem: newMessage.trim(),
                medico_id: medicoId
              }
            });
          }
        });
      } else {
        // Financeiro enviando para médico
        const { data: medico } = await supabase
          .from('medicos')
          .select('numero_whatsapp')
          .eq('id', medicoId)
          .single();

        if (medico?.numero_whatsapp) {
          await supabase.functions.invoke('send-whatsapp-template', {
            body: {
              type: 'resposta_financeiro',
              numero_destino: medico.numero_whatsapp,
              mensagem: newMessage.trim(),
              gestor_nome: gestorNome || 'Financeiro'
            }
          });
        }
      }

      setNewMessage("");
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && !fullscreen && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            onClick={() => setIsOpen(true)}
            size="lg"
            className="rounded-full w-16 h-16 shadow-elegant hover:shadow-glow bg-gradient-primary relative"
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground border-0 min-w-6 h-6 flex items-center justify-center">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </motion.div>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {(isOpen || fullscreen) && (
          <motion.div
            initial={fullscreen ? {} : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={fullscreen ? {} : { opacity: 0, y: 20, scale: 0.95 }}
            className={fullscreen ? "h-full" : "fixed bottom-6 right-6 z-50 w-96"}
          >
            <Card className={`glass-card border-primary/20 shadow-elegant ${fullscreen ? 'h-full flex flex-col' : ''}`}>
              <CardHeader className="pb-3 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-3 h-3 rounded-full ${
                      currentTicketStatus === 'finalizado' ? 'bg-muted' : 'bg-success animate-pulse'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {isGestor 
                          ? `Chat com ${medicoNome}` 
                          : gestorNome 
                            ? `Chat com ${gestorNome}` 
                            : 'Chat Financeiro'
                        }
                      </CardTitle>
                      {currentTicketStatus === 'finalizado' && (
                        <p className="text-xs text-muted-foreground">Atendimento finalizado</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isGestor && currentTicketStatus === 'em_atendimento' && fullscreen && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            loadAvailableGestores();
                            setShowTransferDialog(true);
                          }}
                          className="gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          Transferir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCloseTicket}
                          disabled={closingTicket}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Finalizar
                        </Button>
                      </>
                    )}
                    {!fullscreen && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsMinimized(!isMinimized)}
                          className="h-8 w-8"
                        >
                          {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsOpen(false)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              {(!isMinimized || fullscreen) && (
                <CardContent className={`p-0 ${fullscreen ? 'flex-1 flex flex-col' : ''}`}>
                  {/* Messages */}
                  <ScrollArea className={`p-4 ${fullscreen ? 'flex-1' : 'h-96'}`} ref={scrollRef}>
                    <div className="space-y-3">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma mensagem ainda</p>
                          <p className="text-xs">Inicie a conversa!</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isOwn = isGestor ? msg.sender_type === 'financeiro' : msg.sender_type === 'medico';
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                  isOwn
                                    ? 'bg-gradient-primary text-primary-foreground'
                                    : 'glass-effect border border-border/50'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-4 border-t border-border/50 flex-shrink-0">
                    <div className="flex gap-2">
                      <Input
                        placeholder={currentTicketStatus === 'finalizado' ? 'Atendimento finalizado' : 'Digite sua mensagem...'}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={currentTicketStatus === 'finalizado'}
                        className="glass-effect border-border/50"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={sending || !newMessage.trim() || currentTicketStatus === 'finalizado'}
                        size="icon"
                        className="bg-gradient-primary flex-shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Atendimento</DialogTitle>
            <DialogDescription>
              Selecione o gestor que continuará este atendimento com {medicoNome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Select value={selectedTransferGestor} onValueChange={setSelectedTransferGestor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um gestor" />
              </SelectTrigger>
              <SelectContent>
                {availableGestores.map((gestor) => (
                  <SelectItem key={gestor.id} value={gestor.id}>
                    {gestor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleTransferTicket} 
              disabled={!selectedTransferGestor || transferring}
            >
              {transferring ? 'Transferindo...' : 'Transferir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}