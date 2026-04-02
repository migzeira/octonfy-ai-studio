
# Corrigir e Completar a Aba Agendamentos

## Problemas encontrados

1. **Botão Editar não existe** — o state `editSchedule` foi declarado mas nunca é usado. Não há botão de editar nem modal de edição.
2. **Sem execução manual** — não há botão "Executar agora" para disparar um agendamento imediatamente.
3. **Sem validação de agente** — permite criar agendamento sem selecionar agente, mas o edge function ignora sem agente.
4. **Sem feedback visual de execução** — não mostra o resultado da última execução.
5. **Cron job não configurado** — a edge function `check-schedules` existe mas não tem cron para ser chamada periodicamente.
6. **Sem realtime** — a lista não atualiza sozinha quando um agendamento dispara.

## Correções

### 1. SchedulesPage.tsx — Reescrita completa
- Adicionar botão **Editar** em cada agendamento (abre modal preenchido)
- Adicionar botão **Executar agora** que chama `check-schedules` ou `autonomous-ceo`
- Validar que agente é obrigatório
- Modal de edição reutiliza o formulário de criação
- Stats cards: Total, Ativos, Execuções hoje
- Realtime via subscription na tabela `schedules`
- Mostrar instrução resumida no card
- Loading state no botão executar

### 2. Configurar cron job
- Usar pg_cron + pg_net para chamar `check-schedules` a cada minuto
- Isso faz os agendamentos dispararem automaticamente

### Arquivos modificados
- `src/pages/SchedulesPage.tsx` — reescrita completa
- SQL insert para configurar cron job
