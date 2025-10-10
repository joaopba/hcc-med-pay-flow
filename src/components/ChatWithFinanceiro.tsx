import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, X, Minimize2, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  sender_type: 'medico' | 'financeiro';
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
}

export default function ChatWithFinanceiro({ medicoId, medicoNome, isGestor = false, fullscreen = false, gestorNome }: ChatWithFinanceiroProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isOpen, setIsOpen] = useState(fullscreen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen || fullscreen) {
      loadMessages();
      if (isGestor) markAsRead();
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
  }, [messages]);

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

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

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
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                    <CardTitle className="text-base">
                      {isGestor 
                        ? `Chat com ${medicoNome}` 
                        : gestorNome 
                          ? `Chat com ${gestorNome}` 
                          : 'Chat Financeiro'
                      }
                    </CardTitle>
                  </div>
                  {!fullscreen && (
                    <div className="flex items-center gap-1">
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
                    </div>
                  )}
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
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="glass-effect border-border/50"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={sending || !newMessage.trim()}
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
    </>
  );
}