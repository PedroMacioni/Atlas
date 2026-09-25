# Atlas Presentation Mode - Design Spec

**Data:** 2026-09-25
**Objetivo:** Criar um modo de apresentação profissional para gravação de vídeo demo do Atlas

---

## 1. Visão Geral

### 1.1 Problema

O Atlas precisa de uma demonstração em vídeo profissional que mostre todas as capacidades do app de forma cinematográfica, com transições suaves, indicadores visuais claros, e uma narrativa coesa do início ao fim.

### 1.2 Solução

Um "Modo Apresentação" (`?presentation=1`) que transforma o demo existente em uma apresentação guiada com 7 atos, overlays explicativos com blur nativo iOS, animações spring, haptic feedback, e controles de apresentador.

### 1.3 Critérios de Sucesso

- Apresentação fluida de ponta a ponta sem intervenção manual
- Visual nativo iOS (blur, spring animations, haptics)
- Cada feature do Atlas é demonstrada com contexto explicativo
- Controles permitem pausar/avançar/voltar para gravação

---

## 2. Os 7 Atos

| Ato | Nome | Duração | Descrição |
|-----|------|---------|-----------|
| 1 | Introdução | 5s | Logo animado, título "Copiloto Inteligente" |
| 2 | Definir Destino | 8s | Busca auto-digitada, seleção de destino |
| 3 | Navegação Ativa | 15s | Mapa 3D, instruções de manobra, métricas |
| 4 | IA em Ação | 10s | Recomendação aparece com glow, spotlight |
| 5 | Desvio Inteligente | 12s | Aceita recomendação, rota atualiza |
| 6 | Interação por Voz | 8s | Comando de voz simulado |
| 7 | Resumo da Viagem | 10s | Rota desenha, métricas contam |

**Total:** ~68 segundos de apresentação automática

---

## 3. Roteiro Detalhado

### 3.1 Ato 1: Introdução (5s)

**Tela:** Splash dedicada com logo Atlas

**Animações:**
- Logo fade in + scale (0 → 1) com spring
- Título "Copiloto Inteligente de Viagem" aparece com typewriter
- Partículas sutis no fundo (opcional)

**Haptic:** Light ao iniciar

**Legenda:** Nenhuma

**Auto-advance:** 5s → Ato 2

---

### 3.2 Ato 2: Definir Destino (8s)

**Tela:** Destination screen

**Sequência:**
1. (0.0s) Tela de destino aparece
2. (0.5s) Campo de busca recebe foco, cursor pisca
3. (0.5s-2.5s) "São Paulo Expo" digita automaticamente
4. (3.0s) Resultados aparecem com slide up
5. (3.5s) Spotlight no primeiro resultado
6. (5.0s) Resultado "selecionado" com haptic
7. (7.0s) Transição para mapa

**Legenda:** "Busque por voz ou texto — o Atlas encontra qualquer lugar"

**Haptic:** Selection ao selecionar destino

---

### 3.3 Ato 3: Navegação Ativa (15s)

**Tela:** Trip screen com mapa 3D

**Sequência:**
1. (0.0s) Mapa 3D aparece, demo drive já em movimento
2. (1.0s) Legenda aparece
3. (1.0s-12.0s) Carro segue rota, câmera 3D acompanha
4. (4.0s, 8.0s) Instruções de manobra mudam
5. Métricas (tempo, distância, ETA) atualizam em tempo real

**Legenda:** "Navegação 3D em tempo real com instruções de manobra"

**Haptic:** Nenhum (imersão)

---

### 3.4 Ato 4: IA em Ação (10s)

**Tela:** Trip screen com overlay

**Sequência:**
1. (0.0s) Demo drive pausa automaticamente
2. (0.5s) Overlay escuro aparece (spotlight mode)
3. (1.0s) Card de recomendação sobe com spring
4. (1.5s) Ícone pulsa 2x
5. (2.0s) Borda faz glow pulse (loop)
6. (2.0s-9.0s) Card permanece em destaque

**Cenário forçado:** hora=15, minutos_viagem=240, minutos_sem_parada=180, emocao="cansado"

**Legenda:** "A IA analisou: 4h de viagem, sinais de fadiga — hora de parar"

**Haptic:** Notification Success

---

### 3.5 Ato 5: Desvio Inteligente (12s)

**Tela:** Trip screen → Place selection → Trip screen

**Sequência:**
1. (0.0s) Botão "Aceitar" é "pressionado" (scale + haptic)
2. (0.5s) Lista de lugares aparece (slide up)
3. (2.0s) Spotlight no primeiro lugar
4. (4.0s) Lugar selecionado
5. (5.0s) Mapa mostra nova rota com animação (desvio em laranja)
6. (6.0s) Toast "Rota atualizada +5 min"
7. (7.0s) Demo drive resume
8. (7.0s-11.0s) Viagem continua brevemente

**Legenda:** "O Atlas ajusta a rota automaticamente — seu destino final não muda"

**Haptic:** Impact Medium ao selecionar

---

### 3.6 Ato 6: Interação por Voz (8s)

**Tela:** Voice overlay

**Sequência:**
1. (0.0s) Ícone de microfone aparece (escutando)
2. (0.5s) Waveform anima
3. (1.0s-3.0s) Texto "Quanto falta pra chegar?" aparece (typewriter)
4. (4.0s) Resposta aparece: "Faltam 58 km, chegada às 14:32"
5. (6.0s) Overlay fecha

**Legenda:** "Controle por voz — mãos no volante, olhos na estrada"

**Haptic:** Light ao "ouvir"

---

### 3.7 Ato 7: Resumo da Viagem (10s)

**Tela:** Trip summary (history/[id])

**Sequência:**
1. (0.0s) Viagem "completa" automaticamente
2. (0.5s) Tela de resumo aparece
3. (1.0s) Mapa faz zoom out
4. (1.5s-3.5s) Linha do percurso desenha progressivamente
5. (4.0s) Pins de paradas aparecem com bounce
6. (5.0s-6.0s) Métricas contam de 0 até valor final
7. (7.0s) Card de emoção faz fade in
8. (8.0s-10.0s) Pausa final

**Legenda:** "Relatório completo da viagem — pronto para compartilhar"

**Haptic:** Notification Success

---

## 4. Componentes Visuais

### 4.1 Caption Bar (Legenda)

Barra superior com blur nativo do iOS:

```
┌─────────────────────────────────────────┐
│  🧠 O Atlas detectou sinais de fadiga   │  ← BlurView tint="systemMaterialDark"
│  e está sugerindo uma parada            │    intensity=80
└─────────────────────────────────────────┘
```

- Posição: top safe area + 16px
- Padding: 16px horizontal, 12px vertical
- Border radius: 12px
- Entra com FadeIn (300ms)
- Sai com FadeOut (200ms)

### 4.2 Spotlight Overlay

Overlay escuro com "buraco" para elemento em foco:

- Fundo: rgba(0, 0, 0, 0.6)
- Spotlight: área clara com feather edges
- Transição: 400ms entre elementos
- Implementação: SVG mask ou multiple views

### 4.3 Control Bar (Controles do Apresentador)

Barra inferior com blur:

```
┌─────────────────────────────────────────┐
│  ◀  │  ● ● ● ○ ○ ○ ○  (3/7)  │  ▶  │ ⏸ │
└─────────────────────────────────────────┘
```

- BlurView tint="systemMaterial" intensity=100
- Posição: bottom safe area
- Botões: SF Symbols (chevron.left, chevron.right, pause.fill/play.fill)
- Act indicator: círculos preenchidos/vazios

### 4.4 Animação de Entrada do Card

Quando recomendação aparece:

1. **Slide up:** translateY 100% → 0 (300ms, spring)
2. **Scale spring:** scale 0.95 → 1.0 (200ms)
3. **Glow pulse:** shadow opacity 0.3 → 0.6 → 0.3 (1.5s loop)
4. **Icon pulse:** scale 1.0 → 1.2 → 1.0 (300ms, 2x)

Spring config:
```typescript
{
  damping: 15,
  stiffness: 150,
  mass: 1
}
```

### 4.5 Animação de Desenho da Rota

No resumo da viagem:

1. Polyline com strokeDasharray
2. strokeDashoffset anima de length → 0 (2000ms)
3. Easing: easeInOut

### 4.6 Contador Animado

Métricas contam de 0 até valor final:

- Duração: 1000ms
- Easing: easeOut
- Formato mantido (116 km, 1h52, etc)

---

## 5. Interações e Controles

### 5.1 Controles do Apresentador

| Ação | Efeito |
|------|--------|
| Tap em qualquer lugar | Avança para próximo ato |
| Swipe left | Volta ao ato anterior |
| Botão ▶ | Avança para próximo ato |
| Botão ◀ | Volta ao ato anterior |
| Botão ⏸/▶ | Pausa/resume apresentação |
| Long press | Pausa apresentação |

### 5.2 Haptic Feedback

| Evento | Tipo |
|--------|------|
| Iniciar apresentação | Light |
| Mudar de ato | Light |
| Selecionar item | Selection |
| Recomendação aparece | Notification Success |
| Concluir apresentação | Notification Success |
| Tap em botão | Impact Light |

---

## 6. Arquitetura Técnica

### 6.1 Estrutura de Arquivos

```
src/features/presentation/
├── constants/
│   └── acts.ts                 # Definição dos 7 atos
├── hooks/
│   ├── use-presentation.ts     # Estado principal
│   └── use-act-runner.ts       # Executa sequência de cada ato
├── components/
│   ├── presentation-overlay.tsx    # Container principal
│   ├── caption-bar.tsx             # Legenda com blur
│   ├── control-bar.tsx             # Controles do apresentador
│   ├── act-indicator.tsx           # Indicador ● ● ○ ○
│   ├── spotlight-overlay.tsx       # Overlay com spotlight
│   ├── intro-screen.tsx            # Ato 1
│   └── animated-typing.tsx         # Efeito typewriter
├── animations/
│   ├── card-entrance.ts            # Spring animation
│   ├── glow-pulse.ts               # Glow loop
│   ├── route-draw.ts               # Desenho da rota
│   └── counter.ts                  # Contagem animada
└── state/
    └── presentation-state.ts       # Estado externo
```

### 6.2 Tipos Principais

```typescript
// constants/acts.ts
export type Act = {
  id: number;
  name: string;
  duration: number; // ms até auto-advance (0 = manual)
  caption: string | null;
  haptic: 'light' | 'medium' | 'success' | 'none';
  spotlight?: {
    target: SpotlightTarget;
  };
  sequence: ActStep[];
};

export type ActStep =
  | { type: 'wait'; ms: number }
  | { type: 'caption'; text: string }
  | { type: 'spotlight'; target: string }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'simulate-tap'; target: string }
  | { type: 'demo-pause' }
  | { type: 'demo-resume' }
  | { type: 'trigger-recommendation'; scenario: DemoScenario }
  | { type: 'auto-type'; text: string; field: string }
  | { type: 'navigate'; to: string }
  | { type: 'complete-trip' };

export type SpotlightTarget =
  | 'recommendation-card'
  | 'search-field'
  | 'search-result'
  | 'place-row'
  | 'accept-button'
  | 'voice-indicator'
  | 'map'
  | null;
```

### 6.3 Hook Principal

```typescript
// hooks/use-presentation.ts
export function usePresentation() {
  const [currentAct, setCurrentAct] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [caption, setCaption] = useState<string | null>(null);

  const nextAct = useCallback(() => {
    if (currentAct < 7) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentAct(prev => prev + 1);
    }
  }, [currentAct]);

  const prevAct = useCallback(() => {
    if (currentAct > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentAct(prev => prev - 1);
    }
  }, [currentAct]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return {
    currentAct,
    isPaused,
    spotlight,
    caption,
    nextAct,
    prevAct,
    togglePause,
    setSpotlight,
    setCaption,
  };
}
```

### 6.4 Integração com Trip Screen

```typescript
// trip.tsx
const isDemo = demoParam === '1';
const isPresentation = presentationParam === '1';

// Presentation mode ativa demo automaticamente
const effectiveDemo = isDemo || isPresentation;

return (
  <>
    <TripContent ... />

    {isPresentation && (
      <PresentationOverlay
        demoDrive={demoDrive}
        onTriggerRecommendation={triggerRecommendation}
        onAcceptRecommendation={handleAccept}
        onCompleteTrip={concludeDemoTrip}
      />
    )}
  </>
);
```

---

## 7. Dependências

### 7.1 Pacotes Necessários

| Pacote | Versão | Uso |
|--------|--------|-----|
| expo-blur | já instalado | BlurView nativo |
| expo-haptics | já instalado | Feedback tátil |
| react-native-reanimated | já instalado | Animações spring |
| expo-symbols | verificar | SF Symbols (opcional) |

### 7.2 Verificações Necessárias

- [ ] expo-blur funciona corretamente no iOS
- [ ] expo-symbols disponível no SDK atual
- [ ] Reanimated layout animations funcionando

---

## 8. Pontos de Integração

### 8.1 Com Demo Existente

- `useDemoDrive`: controlar pause/resume, obter posição
- `demoScenario`: forçar cenário para recomendação
- `useRecommendation`: disparar busca de recomendação
- `useDetour`: aceitar desvio programaticamente

### 8.2 Com Navegação

- Presentation mode precisa navegar entre telas (home → destination → trip → summary)
- Usar expo-router navigation
- Manter overlay visível durante transições

### 8.3 Com Voice

- Simular visualmente (não precisa ativar microfone real)
- Mostrar waveform falso e texto

---

## 9. Considerações

### 9.1 Performance

- Spotlight overlay pode ser pesado; usar técnica eficiente (SVG mask ou rasterização)
- Animações devem rodar em 60fps
- Blur nativo é mais performático que blur JS

### 9.2 Testabilidade

- Cada ato pode ser testado isoladamente
- Sequence runner deve ser determinístico
- Estados devem ser resetáveis

### 9.3 Manutenção

- Atos definidos declarativamente (fácil de ajustar timing/texto)
- Animações extraídas em módulos reutilizáveis
- Spotlight targets identificados por testID ou ref

---

## 10. Fora do Escopo

- Gravação de vídeo embutida (usuário grava externamente)
- Narração de áudio automática
- Múltiplos idiomas para legendas (apenas PT-BR)
- Customização dos atos pelo usuário
