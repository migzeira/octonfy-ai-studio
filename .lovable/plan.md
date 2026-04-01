
## Diagnóstico real

O problema não parece mais ser onboarding nem apenas `workspace = null`.

Pelos arquivos atuais, o app autenticado monta assim:

```text
App
└─ PrivateRoute
   └─ AppSidebar
      ├─ useWorkspace()
      ├─ useRealtimeCredits(workspace?.id)
      └─ useAdmin()
           └─ consulta user_roles
```

O ponto mais suspeito hoje é o `useAdmin()` dentro do `AppSidebar`. Ele roda em toda rota privada, inclusive logo após login. Como a tabela `user_roles` tem RLS específica e esse hook não trata estado de erro/carregamento de forma defensiva, ele pode estar derrubando o shell autenticado inteiro antes mesmo da página estabilizar. Isso bate com o seu relato: o dashboard aparece e logo some.

Além disso, ainda há páginas e hooks com guards incompletos:
- `useRealtimeTasks`, `useRealtimeDocuments`, `useCredits` não encerram loading quando `workspace`/`workspaceId` está ausente
- várias páginas usam `workspace!.id` em modais e ações
- o shell privado ainda depende de `AppSidebar` renderizar sem falhas para qualquer rota abrir

## Correção proposta imediata

### 1. Remover o hook `useAdmin()` do shell principal
- Tirar `useAdmin()` de `AppSidebar`
- Remover badge de admin da sidebar por enquanto
- Deixar a lógica admin isolada apenas onde for realmente necessária

Objetivo: eliminar a fonte mais provável do crash no layout autenticado.

### 2. Blindar o layout privado
- Refatorar `PrivateLayout` para mostrar um shell mínimo seguro enquanto auth/workspace estão resolvendo
- Só montar `AppSidebar` quando:
  - auth terminou
  - `requireWorkspace` estiver satisfeito
- Se não houver workspace ainda, navegar direto para `/dashboard` com fallback de setup leve, sem depender de onboarding visual

### 3. Simplificar drasticamente o `DashboardPage`
Trocar temporariamente o dashboard atual por uma versão segura e mínima:
- saudação
- nome do workspace
- saldo de créditos
- contagem de agentes
- botões para `/office`, `/agents`, `/settings`

Sem gráficos, sem consultas extras de tasks/meetings/transactions no primeiro render.

Objetivo: isolar o crash. Se o dashboard abrir estável, depois reintroduzimos partes aos poucos.

### 4. Corrigir todos os hooks com loading/empty state consistente
Ajustar:
- `useRealtimeTasks`
- `useRealtimeDocuments`
- `useCredits`

Padrão:
```ts
if (!workspaceId) {
  setLoading(false);
  setDataVazia(...)
  return;
}
```

Também limpar estado anterior ao trocar de workspace para evitar lixo de sessão anterior.

### 5. Blindar páginas privadas contra `workspace!`
Nas páginas mais críticas:
- `TasksPage`
- `DocumentsPage`
- `MeetingsPage`
- `SchedulesPage`
- `SettingsPage`
- `CreditsPage`

Adicionar early return:
```ts
if (!workspace) return <PageLoadingOrEmptyState />
```

E remover usos diretos de `workspace!.id` no render.

### 6. ErrorBoundary mais útil
Melhorar o fallback para mostrar:
- “Erro no layout autenticado” ou “Erro nesta página”
- botão “Tentar novamente”
- botão “Voltar ao dashboard”

E logar também:
- mensagem
- stack
- nome da rota atual

## Ordem de implementação

1. Remover `useAdmin()` da `AppSidebar`
2. Endurecer `PrivateLayout` / `PrivateRoute`
3. Substituir `DashboardPage` por versão mínima e estável
4. Corrigir hooks com `loading` travado
5. Blindar páginas com `workspace` opcional
6. Melhorar `ErrorBoundary`

## Resultado esperado

Depois dessas mudanças:
- login não deve mais “entrar e cair”
- usuário novo entra direto no dashboard sem onboarding manual
- o shell autenticado deixa de depender de consultas frágeis
- mesmo que uma página específica falhe depois, o app principal continua acessível

## Detalhes técnicos

Arquivos prioritários:
- `src/components/AppSidebar.tsx`
- `src/hooks/useAdmin.tsx`
- `src/components/PrivateRoute.tsx`
- `src/App.tsx`
- `src/pages/DashboardPage.tsx`
- `src/hooks/useRealtimeTasks.tsx`
- `src/hooks/useRealtimeDocuments.tsx`
- `src/hooks/useCredits.tsx`

Mudança-chave de estratégia:
```text
Antes:
Login -> monta shell completo -> sidebar consulta admin/créditos -> página consulta vários dados -> crash

Depois:
Login -> valida auth/workspace -> monta shell mínimo -> dashboard simples -> demais módulos carregam de forma defensiva
```
