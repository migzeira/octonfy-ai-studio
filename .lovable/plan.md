
# Octonfy — Projeto Base SaaS

## 1. Design System
- Atualizar `index.css` com as variáveis CSS especificadas (bg-main #0a0a0f, blue #3b82f6, purple #6366f1, card #111118, etc.)
- Configurar Tailwind com cores customizadas, fonte Inter (Google Fonts)
- Criar classes utilitárias: gradiente CTA (blue→purple), glow neon, glassmorphism para modais

## 2. Banco de Dados (Supabase Migrations)
- Criar todas as 11 tabelas com RLS: workspaces, agents, messages, tasks, documents, meetings, schedules, credits, transactions, event_logs, integrations
- Cada tabela com políticas RLS baseadas em workspace ownership via `auth.uid()`

## 3. Configuração Supabase Client
- Criar `src/lib/supabase.ts` usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Criar hook `useAuth` para gerenciar estado de autenticação
- Criar hook `useWorkspace` para verificar/carregar workspace do usuário

## 4. Proteção de Rotas
- Componente `PrivateRoute`: não autenticado → /login, sem workspace → /onboarding, com workspace → renderiza rota
- Todas as rotas privadas envolvidas pelo PrivateRoute

## 5. Landing Page (/)
- **Hero**: fundo escuro com grid de pontos animado (CSS), badge neon, H1 com gradiente 64px, subtítulo, 2 CTAs, mockup placeholder do office
- **Features**: grid 3x2 com 6 cards (Time Autônomo, Multi-Modelo, Agendamentos, Créditos, Integrações, White Label) com hover glow
- **Como Funciona**: 3 passos horizontais conectados por linha
- **Planos**: 3 cards (Starter grátis, Pro R$119, Business R$299) com badge "Mais Popular" no Pro
- **Footer**: links e copyright

## 6. Login (/login)
- Card glassmorphism centralizado com logo gradiente
- Campos email/senha (toggle show/hide), botão gradiente com loading
- Autenticação via `signInWithPassword()`, tratamento de erros
- Links para esqueci senha e criar conta
- Pós-login: verificar workspace e redirecionar

## 7. Register (/register)
- Mesmo estilo visual do login
- Campos: nome, email, senha, confirmar senha
- Validação: senha ≥ 8 chars, senhas iguais, email válido
- `signUp()` e redirect para /onboarding

## 8. Onboarding (/onboarding)
- Fluxo 5 passos com barra de progresso visual (steps coloridos com check/pulsação)
- Passo 1: Nome da empresa
- Passo 2: Missão
- Passo 3: Produtos/serviços
- Passo 4: Cultura
- Passo 5: Criar primeiro agente (CEO) com campos pré-preenchidos editáveis (nome, cargo, especialidade, modelo, cor, system prompt)
- Ao finalizar: criar workspace + credits (500) + agente CEO + event_log → redirect /office

## 9. Sidebar Global
- Componente sidebar para todas as rotas privadas (240px, colapsável para 64px)
- Topo: logo Octonfy + nome da empresa
- Menu: 11 itens com ícones Lucide, item ativo com gradiente blue→purple
- Rodapé: badge de créditos (verde/amarelo/vermelho), avatar + email, logout

## 10. Páginas Placeholder
- Criar páginas stub para /dashboard, /office, /agents, /tasks, /documents, /meetings, /schedules, /integrations, /credits, /logs, /settings — apenas título + "Em construção"

## 11. Estrutura de Rotas (App.tsx)
- Configurar todas as 15 rotas com React Router
- Rotas públicas: /, /login, /register
- Rota semi-protegida: /onboarding (precisa auth, não precisa workspace)
- Rotas privadas: todas as demais com PrivateRoute + layout com sidebar
