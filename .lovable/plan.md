

# Varredura da aba Configurações + Correção de Build Errors

## Bugs e problemas encontrados

### 1. Build errors críticos (app não compila)

**`src/hooks/useAgentAnimations.tsx` linha 4**: Importa `getDeskPos` e `getMeetingChairPos` de `OfficeCanvas`, mas essas funções não existem mais (foram removidas na reescrita do canvas). O hook inteiro usa `Konva` que também foi removido do canvas.

**`src/components/office/OfficeCanvas.tsx` linha 1159**: Comparação TypeScript impossível — `st` já foi narrowed para `"working" | "thinking"` mas depois compara com `"in_meeting"`, que o TS rejeita.

**Correção**: 
- Reescrever `useAgentAnimations.tsx` como um hook leve (sem Konva, sem referências ao canvas antigo) que apenas calcula posições/estados para o novo canvas
- Corrigir a lógica de comparação na linha 1159

### 2. Conflito Workspace notes vs Office settings

A seção "Escritório" salva `ceo_interval` e `default_mode` dentro de `additional_notes` como JSON. Mas a seção "Workspace" mostra `additional_notes` como texto livre editável. Se o usuário digita texto na seção Workspace e salva, **sobrescreve** as configurações do escritório. E vice-versa.

**Correção**: Separar — a seção Workspace NÃO deve editar `additional_notes` diretamente. Guardar settings do escritório em um campo separado ou em prefixo JSON protegido.

### 3. Cancelar conta não funciona

O botão "Excluir conta" apenas mostra um toast "Funcionalidade em desenvolvimento". Precisa implementar ou remover.

### 4. Notificações salvas apenas em localStorage

Não persiste entre dispositivos. Funciona, mas é limitado.

### 5. Plano mostra "Starter" hardcoded

O card de plano diz "500 créditos iniciais inclusos" fixo, sem consultar o saldo real.

---

## Ideias para completar a aba

1. **Seção "Aparência"** — tema claro/escuro, tamanho de fonte do chat
2. **Exportar/Importar dados** — baixar workspace completo (agentes, docs, tasks) como JSON
3. **Gerenciar API Keys** — ver/editar chaves das integrações conectadas direto nas settings
4. **Idioma** — seletor PT-BR / EN / ES
5. **Logout visível** — botão de sair na seção Conta (hoje só existe no sidebar)
6. **Histórico de atividade** — últimas ações no workspace (já tem `event_logs`)

---

## Plano de implementação

### Passo 1 — Corrigir build errors
- **`useAgentAnimations.tsx`**: Reescrever como stub simples (export vazio ou hook que retorna estado mínimo) já que o novo `OfficeCanvas.tsx` não o usa
- **`OfficeCanvas.tsx` linha 1159**: Simplificar condição para `const isWorking = (st === "working" || st === "thinking") && !meets.includes(id);`

### Passo 2 — Corrigir conflito additional_notes
- Na seção "Workspace", remover o campo `additional_notes` do formulário visual (ou torná-lo read-only)
- Na seção "Escritório", continuar salvando JSON em `additional_notes` mas de forma isolada

### Passo 3 — Polir seção Conta
- Mostrar saldo real de créditos (consultar tabela `credits`)
- Implementar exclusão de conta real (deletar workspace + signOut) ou esconder botão
- Adicionar botão de Logout

### Passo 4 — Adicionar seção Aparência
- Nova aba com toggle tema claro/escuro (salvo em localStorage)
- Opção de densidade da UI (compacto/confortável)

### Arquivos modificados
- `src/hooks/useAgentAnimations.tsx` — reescrever como stub
- `src/components/office/OfficeCanvas.tsx` — fix linha 1159
- `src/pages/SettingsPage.tsx` — corrigir conflito notes, polir conta, adicionar seção aparência

