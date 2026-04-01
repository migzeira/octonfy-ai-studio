

# Correção: Loop de Onboarding + Workspace Duplicado

## Causa Raiz

O usuário tem **2 workspaces idênticos** no banco ("Octonfy Office"). Quando `useWorkspace` faz a query com `.eq("user_id", user.id).maybeSingle()`, o Supabase retorna **erro** porque `maybeSingle()` falha quando encontra mais de 1 resultado. Isso faz `workspace = null`, e o `PrivateRoute` redireciona para `/onboarding`, onde o usuário cria mais um workspace, piorando o problema.

Fluxo do bug:
1. Login OK
2. `useWorkspace` busca workspaces → encontra 2 → `maybeSingle()` retorna erro
3. `workspace = null` → PrivateRoute redireciona para `/onboarding`
4. Usuário preenche onboarding → cria **terceiro** workspace
5. Erro ErrorBoundary aparece (possível RLS ou outro conflito)
6. Recarrega → volta ao passo 2

## Correções

### 1. Limpar workspace duplicado (dados)
- Deletar o workspace antigo (`9204795c-...`) e seus dados relacionados (agents, credits, event_logs)
- Manter o mais recente (`776be176-...`) conforme escolha do usuário

### 2. Corrigir `useWorkspace.tsx` (prevenir reincidência)
- Trocar `.maybeSingle()` por `.order("created_at", { ascending: false }).limit(1).maybeSingle()`
- Isso garante que mesmo com duplicatas, retorna o mais recente sem erro

### 3. Corrigir `OnboardingPage.tsx` (guarda contra duplicata)
- Antes de criar workspace, verificar se já existe um para o usuário
- Se já existe, redirecionar para `/office` em vez de criar outro

### 4. Preview branco no editor
- Provavelmente causado pelo mesmo bug (crash no useWorkspace antes de renderizar qualquer coisa) ou cache do preview. Após as correções acima, deve resolver.

## Detalhes Técnicos

**useWorkspace.tsx linha 39-43** — mudar query:
```typescript
const { data, error } = await supabase
  .from("workspaces")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

**OnboardingPage.tsx** — adicionar verificação no início de `handleFinish`:
```typescript
// Check if workspace already exists
const { data: existing } = await supabase
  .from("workspaces").select("id")
  .eq("user_id", user.id).limit(1).maybeSingle();
if (existing) {
  navigate("/office", { replace: true });
  return;
}
```

**Limpeza de dados** — SQL migration para deletar workspace antigo e dados órfãos:
- DELETE agents, credits, event_logs WHERE workspace_id = antigo
- DELETE workspaces WHERE id = antigo

