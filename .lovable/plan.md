# Fase 4 — Telas Completas do Octonfy

## 1. Dependências
- Instalar `@dnd-kit/core` e `@dnd-kit/sortable` para Kanban drag-and-drop
- Instalar `marked` para renderização de markdown no editor de documentos

## 2. Tarefas (/tasks)
- Kanban com 4 colunas (todo, in_progress, done, cancelled)
- Drag and drop com @dnd-kit
- Filtros: busca, agente, prioridade, data
- Modal nova/editar tarefa com prioridade visual, agente, data
- Modal detalhes com histórico de atualizações
- Cards com badge prioridade, avatar agente, data limite

## 3. Documentos (/documents)
- Grid de cards com filtros por tipo, autor, tags
- Modal editor full-screen com toolbar markdown
- Preview markdown lado a lado
- Auto-save a cada 3s
- Sidebar de metadados no editor

## 4. Reuniões (/meetings)
- Lista vertical de reuniões com filtros de status
- Modal nova reunião (seleção de participantes)
- Modal transcrição (full-screen)
- Botão exportar como documento
- Redirecionamento para /office ao iniciar

## 5. Agendamentos (/schedules)
- Cards de sugestão quando vazio
- Lista de agendamentos com toggle ativo/inativo
- Modal criação com frequência condicional (diário, semanal, mensal, cron)
- Cálculo automático de next_run
- Edge function check-schedules + pg_cron setup

## 6. Integrações (/integrations)
- Grid de 12 integrações com status (conectado, disponível, em breve)
- Modal genérico por tipo com campos específicos
- Upsert em integrations ao conectar/desconectar

## 7. Logs (/logs)
- Timeline vertical com filtros multi-select
- Scroll infinito (30 por lote)
- Export CSV
- Metadata colapsável com JSON formatado

## 8. Configurações (/settings)
- 4 seções: Workspace, Escritório, Notificações, Conta
- Edição de workspace, preferências localStorage
- Alterar email/senha via auth
- Zona de perigo (UI only)

## 9. Rotas (App.tsx)
- Atualizar todas as rotas placeholder para usar os novos componentes

## 10. Edge Function: check-schedules
- Buscar schedules ativos com next_run <= now()
- Executar via send-message
- Atualizar run_count, last_run, next_run
