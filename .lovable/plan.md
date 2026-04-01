

# Auditoria Completa do Octonfy + Admin Master

## Problema Critico #1 — App Completamente Quebrado (Tela Branca)

O app inteiro esta com **tela branca** em todas as rotas. A causa raiz:

**`react-konva@19.2.3` e incompativel com `react@18.3.1`**

O erro no console diz: _"react-konva version 19 is only compatible with React 19"_. Como o `OfficeCanvas.tsx` importa `react-konva` e o Vite faz tree-shaking/pre-bundling, o erro se propaga para todo o app (o modulo crasheia ao ser carregado, e o ErrorBoundary nao consegue capturar erros de import de modulo).

**Correcao:** Trocar `react-konva` para versao 18 compativel com React 18:
- `"react-konva": "^18.2.10"` no package.json

---

## Problema #2 — `@dnd-kit/sortable@10.0.0` pode ser incompativel

A versao 10 do `@dnd-kit/sortable` e muito recente e pode ter breaking changes com `@dnd-kit/core@6.3.1`. Precisa validar apos corrigir o problema #1. Se der erro, fazer downgrade para `@dnd-kit/sortable@^9.0.0` ou `^8.0.0`.

---

## Problema #3 — Edge Functions dependem de LOVABLE_API_KEY

As Edge Functions (`send-message`, `generate-system-prompt`, `start-meeting`, `end-meeting`, `autonomous-ceo`) usam `LOVABLE_API_KEY` para chamar a API de IA via Lovable Cloud. O secret ja existe no projeto, entao deve funcionar. Porem, nao ha logs de execucao, o que indica que ninguem testou ainda (bloqueado pelo problema #1).

---

## Problema #4 — Sem sistema de Admin/Roles

Nao existe tabela de roles no banco. O usuario quer `migueldrops@gmail.com` (user_id: `0687f3fc-edf5-4a9a-8411-2e73f0839975`) como admin master.

**Correcao:**
1. Criar enum `app_role` com valores `admin` e `user`
2. Criar tabela `user_roles` com RLS
3. Criar funcao `has_role()` security definer
4. Inserir role admin para o usuario existente
5. Adicionar verificacao de admin onde necessario (ex: pagina de settings, acoes destrutivas)

---

## Outros pontos verificados (OK ou menor)

| Area | Status | Observacao |
|------|--------|------------|
| Landing Page | OK | Codigo limpo, sem erros |
| Login/Register | OK | Logica de auth correta |
| Onboarding | OK | Redireciona para /office apos finalizar |
| PrivateRoute | OK | Protege rotas corretamente |
| Sidebar | OK | Credits em realtime, menu completo |
| Dashboard | OK | Recharts, KPIs, feed de eventos |
| Agents Page | OK | CRUD completo com modais |
| Tasks/Kanban | Verificar | Depende do fix do dnd-kit |
| Documents | OK | Editor markdown com auto-save |
| Meetings | OK | CRUD + transcript modal |
| Schedules | OK | Frequencias + check-schedules edge fn |
| Integrations | OK | 12 integracoes com modais |
| Logs | OK | Timeline + filtros + CSV export |
| Settings | OK | 4 secoes funcionais |
| Realtime hooks | OK | Agents, messages, credits, meetings, tasks, events |
| RLS Policies | OK | Todas as tabelas protegidas via `is_workspace_owner` |
| Edge Functions | OK (codigo) | Nao testadas por causa do crash |
| ErrorBoundary | OK | Existe e envolve rotas |
| ConnectionStatus | OK | Monitora conectividade |
| NotFound (404) | OK | Pagina customizada |
| CSS/Design | OK | Tema escuro, scrollbar, shimmer, page-enter |

---

## Plano de Implementacao

### Passo 1 — Corrigir react-konva (CRITICO)
- Alterar `package.json`: `"react-konva": "^18.2.10"`
- Isso desbloqueara todo o app

### Passo 2 — Verificar compatibilidade dnd-kit
- Se `@dnd-kit/sortable@10` der erro, fazer downgrade para `^9.0.0`

### Passo 3 — Criar sistema de Admin
- Migration SQL:
  ```sql
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  
  CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
  );
  
  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  
  CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  $$;
  
  CREATE POLICY "Users can read own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  
  CREATE POLICY "Only admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  ```
- Inserir admin: `INSERT INTO user_roles (user_id, role) VALUES ('0687f3fc-edf5-4a9a-8411-2e73f0839975', 'admin');`

### Passo 4 — Hook useAdmin e protecoes
- Criar `useAdmin()` hook que verifica se o user logado tem role admin
- Adicionar indicador visual na sidebar (badge "Admin")
- Proteger acoes criticas (deletar workspace, gerenciar roles) com verificacao admin

### Passo 5 — Habilitar protecao de senhas vazadas
- Ativar Password HIBP Check via configuracao de auth

