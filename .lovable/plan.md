

# Corrigir e Completar a Aba Logs

## Problemas encontrados

### Bugs funcionais
1. **Filtro de tipo quebrado** — o pill "Mensagens" tem key `"dm_sent,broadcast_sent"` como string única, mas o filtro faz `event_type.includes("dm_sent,broadcast_sent")` que nunca dá match. Precisa splittar por vírgula.
2. **Filtragem client-side causa paginação errada** — type filters são aplicados DEPOIS do fetch, então a contagem de `hasMore` e o offset de `loadMore` ficam incorretos (ex: busca 30 do banco, filtra 5, mostra 5 mas diz "carregar mais" baseado nos 30 originais).
3. **Sem realtime** — a página não escuta novos eventos em tempo real. O hook `useRealtimeEvents` existe mas não é usado aqui.
4. **Sem debounce na busca** — cada letra digitada dispara uma query no banco.
5. **Import não usado** — `useRealtimeAgents` é importado mas `agents` nunca é utilizado.
6. **CSV mal escapado** — campos com vírgulas ou aspas quebram o arquivo.

### Funcionalidades faltando
- **Stats resumo** no topo (total de eventos, por tipo mais frequente)
- **Botão limpar filtros** quando filtros estão ativos
- **Indicador de carregamento** no "carregar mais"

## Plano de implementação

### Arquivo: `src/pages/LogsPage.tsx` (reescrever)

1. **Corrigir filtro de tipo** — ao aplicar type pills, splittar keys por vírgula e checar cada parte individualmente com `some()`
2. **Mover filtro de tipo para a query SQL** — usar `.or()` ou `.in()` no Supabase ao invés de filtrar client-side, garantindo paginação correta
3. **Adicionar realtime** — subscribir no channel `postgres_changes` para INSERT em `event_logs` e prepend novos eventos automaticamente
4. **Debounce na busca** — usar `setTimeout` de 400ms antes de disparar fetch
5. **Remover import de `useRealtimeAgents`**
6. **Stats cards** — mostrar 4 cards no topo: Total, Hoje, Tipo mais frequente, Último evento
7. **Botão limpar filtros** — aparece quando há filtros ativos
8. **Loading state no "carregar mais"** — spinner enquanto busca próxima página
9. **CSV robusto** — escapar campos com aspas duplas
10. **Resolver actor display** — quando actor é UUID de agente, mostrar nome do agente (re-adicionar `useRealtimeAgents` com propósito claro)

### Arquivos modificados
- `src/pages/LogsPage.tsx` — reescrita completa com todas as correções

