

# Escritório Pixel Art — Agentes Animados 2D

## O que será feito

Recriar o canvas do escritório com estética **pixel art** inspirada na referência "Pixel Agents". Os agentes serão personagens 2D desenhados com pixels (retângulos pequenos no Konva), com animações baseadas no status:

- **idle** → personagem andando pelo escritório (animação de caminhada leve)
- **working** → sentado na mesa digitando no computador (animação de mãos)
- **thinking** → sentado com balão de pensamento "..."
- **in_meeting** → sentado na sala de reunião
- **messaging** → no computador com ícone de chat piscando
- **offline** → personagem cinza, parado, semi-transparente

## Estrutura visual do escritório

```text
┌─────────────────────────────┬──────────────────┐
│                             │                  │
│   ÁREA DE TRABALHO          │  SALA DE REUNIÃO │
│   (mesas pixel art +        │  (mesa oval +    │
│    computadores + cadeiras)  │   cadeiras)      │
│                             │                  │
│   Piso madeira (tiles)      │  Piso azul       │
│                             │                  │
├─────────────────────────────┤  Sofás pixel     │
│                             │  Plantas         │
│   ÁREA DE DESCANSO          │                  │
│   (sofá, planta, café)      ├──────────────────┤
│                             │  Piso xadrez     │
└─────────────────────────────┴──────────────────┘
```

## Abordagem técnica

### 1. Sprite system com Konva shapes
Criar funções que desenham personagens pixel art usando `Konva.Rect` em grid (cada "pixel" = retângulo 3x3 ou 4x4). Cada agente terá cor baseada no `avatar_color`.

Frames de animação:
- **Walk** (2 frames): pernas alternando
- **Sit/Type** (2 frames): braços alternando no teclado
- **Think** (1 frame + balão animado)
- **Idle standing** (1 frame)

### 2. Cenário pixel art
Substituir o fundo atual (dot grid + retângulos escuros) por:
- **Tiles de piso** em padrão madeira (marrom claro/escuro alternado)
- **Mesas pixel** com monitor, teclado, caneca
- **Sala de reunião** com piso diferente, mesa oval, cadeiras
- **Plantas decorativas** nos cantos
- **Paredes** com textura de tijolo/concreto

### 3. Animação por status
Usar `Konva.Animation` com frame counter para alternar sprites:
- idle: personagem se move lentamente pelo escritório (random walk dentro da área)
- working: sprite sentado na mesa, braços alternando a cada 500ms
- thinking: sprite parado + balão "..." com dots pulsando
- in_meeting: sprite sentado na sala de reunião
- offline: sprite cinza estático

### 4. Labels flutuantes
Acima de cada personagem: badge escuro com status ("Idle", "Working", "Running: ...") e nome/role abaixo — similar à referência.

## Arquivos a criar/modificar

1. **`src/components/office/pixelSprites.ts`** (NOVO)
   - Funções para desenhar sprites pixel art no Konva
   - Definições de frames para cada animação
   - Função de desenho de cenário (mesas, cadeiras, plantas, pisos)

2. **`src/components/office/OfficeCanvas.tsx`** (REESCREVER)
   - Usar sprites pixel em vez de círculos
   - Cenário pixel art com tiles
   - Animação frame-based por status do agente
   - Manter: zoom, minimap, click handlers

3. **`src/hooks/useAgentAnimations.tsx`** (REESCREVER)
   - Simplificar para sistema de frames (tick a cada 500ms)
   - Controlar posição de agentes idle (random walk)
   - Alternar frames de sprites por status

## O que NÃO muda
- Lógica de dados (hooks, Supabase, realtime)
- Sidebar de chat/meeting/status
- Popup de clique no agente
- Minimap (será atualizado visualmente)
- Top bar

## Resultado esperado
Escritório com visual pixel art retrô, personagens 2D animados que reagem ao status real dos agentes, similar ao "Pixel Agents" da referência.

