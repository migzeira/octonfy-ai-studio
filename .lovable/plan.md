

# Reescrever OfficeCanvas com Sprite Sheet LPC + Canvas 2D

## Resumo

Substituir completamente o `OfficeCanvas.tsx` baseado em react-konva por um componente HTML Canvas 2D puro que usa o sprite sheet `/character-spritesheet.png` para animar agentes.

## Mudanças

### 1. Copiar sprite sheet para o projeto
- `lov-copy user-uploads://character-spritesheet.png public/character-spritesheet.png`

### 2. Reescrever `src/components/office/OfficeCanvas.tsx`
- Remover todas as importações de react-konva, konva, pixelSprites e useAgentAnimations
- Usar `<canvas ref={canvasRef}>` com ResizeObserver para preencher 100% do container
- Carregar sprite sheet via `new Image()` em `useRef`
- Estado interno de cada agente: `{ x, y, frameIndex, direction, lastFrameTime, targetX, targetY, status }`

**Sprite frames (64x64 cada):**
- Walk DOWN: row y=640, 9 frames (x = frame * 64)
- Walk LEFT: row y=576, 9 frames  
- Walk RIGHT: row y=704, 9 frames
- Idle: frame 0 de walk down (x=0, y=640)

**Escala:** `ctx.drawImage(img, srcX, srcY, 64, 64, destX, destY, 32, 32)`

**Layout do escritório (constantes mantidas):**
- Background: `#0d0d14`
- Work area (top-left ~70%): piso `#1a1a2e`, mesas `#16213e` com monitores pixel
- Meeting room (top-right ~30%): piso `#0f3460`, mesa oval, cadeiras
- Break area (bottom-right): sofá, plantas, máquina de café
- Paredes com borda `#533483`

**Comportamento por status:**
- `working`: na mesa, sprite idle (frame 0 walk down), ícone 💻 acima
- `thinking`: na mesa, sprite idle, balão "..." animado
- `idle`: wander na break area, walk animado mudando direção a cada 2-3s
- `in_meeting`: na sala de reunião, frame 0 walk right
- `offline`: sprite idle, opacity 0.4

**Labels por agente:**
- Nome em branco abaixo (10px)
- Círculo de status colorido (verde=working, amarelo=thinking, azul=meeting, cinza=idle)

**Animação:** `requestAnimationFrame` loop, troca frame a cada 120ms para walk

**Interação:** click detection via distância ao ponto do agente, chama `onAgentClick`

**Zoom/pan:** manter controles de zoom (+, -, reset) com transform do canvas via `ctx.setTransform()` e mouse wheel

**Mini-map:** reimplementar como mini canvas 160x107 no canto

### 3. Atualizar `src/pages/OfficePage.tsx`
- Manter mesma interface de props (agents: Agent[], onAgentClick, etc.)
- Remover `containerWidth`/`containerHeight` props se o canvas gerenciar próprio sizing via ResizeObserver interno

### 4. Remover dependências obsoletas
- O `pixelSprites.ts` e `useAgentAnimations.tsx` ficam sem uso por este componente (manter por enquanto caso outros importem)

## Arquivos modificados
- **Copiado:** `public/character-spritesheet.png`
- **Reescrito:** `src/components/office/OfficeCanvas.tsx`
- **Atualizado:** `src/pages/OfficePage.tsx` (ajuste de props se necessário)

