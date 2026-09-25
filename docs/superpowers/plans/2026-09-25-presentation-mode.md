# Presentation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a professional video demo mode with 7 guided acts, native iOS components, and presenter controls.

**Architecture:** A `PresentationOverlay` component wraps the existing demo, controlling act progression via a state machine. Each act defines a sequence of steps (wait, animate, navigate, simulate-tap) executed by `useActRunner`. Native iOS blur and haptics provide polish.

**Tech Stack:** React Native, Expo SDK 57, expo-blur, expo-haptics, react-native-reanimated 4.5, expo-router

**Spec:** `docs/superpowers/specs/2026-09-25-presentation-mode-design.md`

## Global Constraints

- Expo SDK 57 — all packages must be SDK 57 compatible
- expo-blur already available — no installation needed
- expo-haptics already available — no installation needed
- react-native-reanimated 4.5.1 already available
- Branch: `feature/presentation-mode`
- All text in Portuguese (PT-BR)
- No new external dependencies beyond what's installed

## Review Focus

1. **Act sequence timing edge cases** — if user rapidly taps next/prev, the sequence runner must cancel cleanly without leaving orphan timeouts or animations
2. **Spotlight positioning on different screen sizes** — spotlight rect must adapt to actual element layout, not hardcoded positions
3. **Demo state synchronization** — presentation must properly pause/resume demo drive and not leave it in inconsistent state when exiting mid-presentation
4. **Memory cleanup on unmount** — all intervals, timeouts, and animation listeners must be cleaned up when leaving presentation mode
5. **Blur fallback on Android** — expo-blur works differently on Android; ensure graceful degradation

---

## File Structure

```
src/features/presentation/
├── constants/
│   └── acts.ts                     # Act definitions with sequences
├── hooks/
│   ├── use-presentation.ts         # Main presentation state
│   └── use-act-runner.ts           # Sequence executor
├── components/
│   ├── presentation-overlay.tsx    # Main overlay container
│   ├── caption-bar.tsx             # Blur caption at top
│   ├── control-bar.tsx             # Blur controls at bottom
│   ├── act-indicator.tsx           # Progress dots
│   ├── spotlight-overlay.tsx       # Dark overlay with spotlight
│   ├── intro-screen.tsx            # Act 1 intro animation
│   └── animated-counter.tsx        # Count-up animation for metrics
├── animations/
│   ├── spring-entrance.ts          # Reanimated spring configs
│   └── glow-pulse.ts               # Pulsing glow effect
└── state/
    └── presentation-state.ts       # External state store
```

**Modifications to existing files:**
- `src/app/trip.tsx` — add presentation mode detection and overlay
- `src/app/destination.tsx` — expose refs for auto-typing simulation
- `src/features/recommendation/components/recommendation-card.tsx` — add testID and animated wrapper
- `src/app/history/[id].tsx` — add animated metrics support

---

### Task 1: Presentation State Store

**Files:**
- Create: `src/features/presentation/state/presentation-state.ts`
- Test: `src/features/presentation/state/presentation-state.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `getPresentationState(): PresentationState`, `setPresentationState(state: Partial<PresentationState>): void`, `resetPresentation(): void`, `usePresentationState(): PresentationState`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/presentation/state/presentation-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPresentationState,
  setPresentationState,
  resetPresentation,
} from './presentation-state';

describe('presentation-state', () => {
  beforeEach(() => {
    resetPresentation();
  });

  it('starts at act 1 and not paused', () => {
    const state = getPresentationState();
    expect(state.currentAct).toBe(1);
    expect(state.isPaused).toBe(false);
  });

  it('updates currentAct', () => {
    setPresentationState({ currentAct: 3 });
    expect(getPresentationState().currentAct).toBe(3);
  });

  it('updates isPaused', () => {
    setPresentationState({ isPaused: true });
    expect(getPresentationState().isPaused).toBe(true);
  });

  it('resets to initial state', () => {
    setPresentationState({ currentAct: 5, isPaused: true });
    resetPresentation();
    const state = getPresentationState();
    expect(state.currentAct).toBe(1);
    expect(state.isPaused).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/presentation/state/presentation-state.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/presentation/state/presentation-state.ts
import { useSyncExternalStore } from 'react';

export type PresentationState = {
  currentAct: number;
  isPaused: boolean;
  caption: string | null;
  spotlightTarget: string | null;
};

const INITIAL_STATE: PresentationState = {
  currentAct: 1,
  isPaused: false,
  caption: null,
  spotlightTarget: null,
};

let state: PresentationState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

export function getPresentationState(): PresentationState {
  return state;
}

export function setPresentationState(next: Partial<PresentationState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function resetPresentation(): void {
  state = { ...INITIAL_STATE };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePresentationState(): PresentationState {
  return useSyncExternalStore(subscribe, getPresentationState, getPresentationState);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/presentation/state/presentation-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/presentation/state/presentation-state.ts src/features/presentation/state/presentation-state.test.ts
git commit -m "feat(presentation): add presentation state store"
```

---

### Task 2: Act Definitions

**Files:**
- Create: `src/features/presentation/constants/acts.ts`
- Test: `src/features/presentation/constants/acts.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ACTS: Act[]`, `Act` type, `ActStep` type, `getAct(id: number): Act | undefined`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/presentation/constants/acts.test.ts
import { describe, it, expect } from 'vitest';
import { ACTS, getAct } from './acts';

describe('acts', () => {
  it('has exactly 7 acts', () => {
    expect(ACTS).toHaveLength(7);
  });

  it('acts are numbered 1 through 7', () => {
    const ids = ACTS.map((act) => act.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('each act has a name and duration', () => {
    for (const act of ACTS) {
      expect(act.name).toBeTruthy();
      expect(typeof act.duration).toBe('number');
    }
  });

  it('getAct returns the correct act', () => {
    const act3 = getAct(3);
    expect(act3?.id).toBe(3);
    expect(act3?.name).toBe('Navegação Ativa');
  });

  it('getAct returns undefined for invalid id', () => {
    expect(getAct(0)).toBeUndefined();
    expect(getAct(8)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/presentation/constants/acts.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/presentation/constants/acts.ts
export type HapticStyle = 'light' | 'medium' | 'success' | 'none';

export type ActStep =
  | { type: 'wait'; ms: number }
  | { type: 'caption'; text: string | null }
  | { type: 'spotlight'; target: string | null }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'simulate-tap'; target: string }
  | { type: 'demo-pause' }
  | { type: 'demo-resume' }
  | { type: 'trigger-recommendation' }
  | { type: 'auto-type'; text: string; field: string }
  | { type: 'navigate'; to: string }
  | { type: 'complete-trip' };

export type Act = {
  id: number;
  name: string;
  duration: number;
  caption: string | null;
  haptic: HapticStyle;
  sequence: ActStep[];
};

export const ACTS: Act[] = [
  {
    id: 1,
    name: 'Introdução',
    duration: 5000,
    caption: null,
    haptic: 'light',
    sequence: [
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 5000 },
    ],
  },
  {
    id: 2,
    name: 'Definir Destino',
    duration: 8000,
    caption: 'Busque por voz ou texto — o Atlas encontra qualquer lugar',
    haptic: 'light',
    sequence: [
      { type: 'navigate', to: '/destination' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'Busque por voz ou texto — o Atlas encontra qualquer lugar' },
      { type: 'auto-type', text: 'São Paulo Expo', field: 'search' },
      { type: 'wait', ms: 500 },
      { type: 'spotlight', target: 'search-result-0' },
      { type: 'wait', ms: 1500 },
      { type: 'haptic', style: 'light' },
      { type: 'simulate-tap', target: 'search-result-0' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    id: 3,
    name: 'Navegação Ativa',
    duration: 15000,
    caption: 'Navegação 3D em tempo real com instruções de manobra',
    haptic: 'none',
    sequence: [
      { type: 'wait', ms: 1000 },
      { type: 'caption', text: 'Navegação 3D em tempo real com instruções de manobra' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 14000 },
    ],
  },
  {
    id: 4,
    name: 'IA em Ação',
    duration: 10000,
    caption: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'trigger-recommendation' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar' },
      { type: 'spotlight', target: 'recommendation-card' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 9000 },
    ],
  },
  {
    id: 5,
    name: 'Desvio Inteligente',
    duration: 12000,
    caption: 'O Atlas ajusta a rota automaticamente — seu destino final não muda',
    haptic: 'medium',
    sequence: [
      { type: 'simulate-tap', target: 'accept-button' },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 500 },
      { type: 'spotlight', target: 'place-row-0' },
      { type: 'caption', text: 'O Atlas ajusta a rota automaticamente — seu destino final não muda' },
      { type: 'wait', ms: 2000 },
      { type: 'simulate-tap', target: 'place-row-0' },
      { type: 'spotlight', target: null },
      { type: 'wait', ms: 1000 },
      { type: 'demo-resume' },
      { type: 'wait', ms: 7000 },
    ],
  },
  {
    id: 6,
    name: 'Interação por Voz',
    duration: 8000,
    caption: 'Controle por voz — mãos no volante, olhos na estrada',
    haptic: 'light',
    sequence: [
      { type: 'demo-pause' },
      { type: 'caption', text: 'Controle por voz — mãos no volante, olhos na estrada' },
      { type: 'spotlight', target: 'voice-indicator' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 7500 },
    ],
  },
  {
    id: 7,
    name: 'Resumo da Viagem',
    duration: 10000,
    caption: 'Relatório completo da viagem — pronto para compartilhar',
    haptic: 'success',
    sequence: [
      { type: 'spotlight', target: null },
      { type: 'complete-trip' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'Relatório completo da viagem — pronto para compartilhar' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 9000 },
    ],
  },
];

export function getAct(id: number): Act | undefined {
  return ACTS.find((act) => act.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/presentation/constants/acts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/presentation/constants/acts.ts src/features/presentation/constants/acts.test.ts
git commit -m "feat(presentation): add act definitions with sequences"
```

---

### Task 3: Spring Entrance Animation

**Files:**
- Create: `src/features/presentation/animations/spring-entrance.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `SPRING_CONFIG`, `springEntranceStyle(progress: SharedValue<number>): AnimatedStyle`

- [ ] **Step 1: Write the animation config**

```typescript
// src/features/presentation/animations/spring-entrance.ts
import type { SharedValue } from 'react-native-reanimated';
import { interpolate, useAnimatedStyle, withSpring, type WithSpringConfig } from 'react-native-reanimated';

export const SPRING_CONFIG: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

export const SPRING_FAST: WithSpringConfig = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

/**
 * Cria um estilo animado para entrada com spring.
 * progress: 0 = fora da tela (abaixo), 1 = posição final
 */
export function useSpringEntranceStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [100, 0]);
    const scale = interpolate(progress.value, [0, 1], [0.95, 1]);
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0, 0.8, 1]);

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });
}

/**
 * Anima um valor para 1 com spring.
 */
export function animateIn(value: SharedValue<number>): void {
  value.value = withSpring(1, SPRING_CONFIG);
}

/**
 * Anima um valor para 0 com spring rápido.
 */
export function animateOut(value: SharedValue<number>): void {
  value.value = withSpring(0, SPRING_FAST);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/animations/spring-entrance.ts
git commit -m "feat(presentation): add spring entrance animation utilities"
```

---

### Task 4: Glow Pulse Animation

**Files:**
- Create: `src/features/presentation/animations/glow-pulse.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `useGlowPulse(): { glowStyle: AnimatedStyle, startPulse: () => void, stopPulse: () => void }`

- [ ] **Step 1: Write the glow animation**

```typescript
// src/features/presentation/animations/glow-pulse.ts
import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

const PULSE_DURATION = 750;

export function useGlowPulse() {
  const glowOpacity = useSharedValue(0);
  const isActive = useRef(false);

  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: colors.primary,
    shadowOpacity: glowOpacity.value,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  }));

  const startPulse = useCallback(() => {
    if (isActive.current) return;
    isActive.current = true;

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: PULSE_DURATION }),
        withTiming(0.3, { duration: PULSE_DURATION })
      ),
      -1, // infinite
      false
    );
  }, [glowOpacity]);

  const stopPulse = useCallback(() => {
    isActive.current = false;
    cancelAnimation(glowOpacity);
    glowOpacity.value = withTiming(0, { duration: 200 });
  }, [glowOpacity]);

  useEffect(() => {
    return () => {
      cancelAnimation(glowOpacity);
    };
  }, [glowOpacity]);

  return { glowStyle, startPulse, stopPulse };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/animations/glow-pulse.ts
git commit -m "feat(presentation): add glow pulse animation"
```

---

### Task 5: Caption Bar Component

**Files:**
- Create: `src/features/presentation/components/caption-bar.tsx`

**Interfaces:**
- Consumes: `text: string | null`
- Produces: `<CaptionBar text={...} />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/caption-bar.tsx
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type CaptionBarProps = {
  text: string | null;
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function CaptionBar({ text }: CaptionBarProps) {
  if (!text) {
    return null;
  }

  return (
    <AnimatedBlurView
      intensity={80}
      tint="systemMaterialDark"
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <Text variant="body" color="textOnPrimary" align="center">
        {text}
      </Text>
    </AnimatedBlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/caption-bar.tsx
git commit -m "feat(presentation): add caption bar with blur"
```

---

### Task 6: Act Indicator Component

**Files:**
- Create: `src/features/presentation/components/act-indicator.tsx`

**Interfaces:**
- Consumes: `currentAct: number`, `totalActs: number`
- Produces: `<ActIndicator currentAct={3} totalActs={7} />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/act-indicator.tsx
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export type ActIndicatorProps = {
  currentAct: number;
  totalActs: number;
};

export function ActIndicator({ currentAct, totalActs }: ActIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: totalActs }, (_, i) => (
          <Dot key={i} filled={i < currentAct} />
        ))}
      </View>
      <Text variant="label" color="textOnPrimary">
        {currentAct}/{totalActs}
      </Text>
    </View>
  );
}

function Dot({ filled }: { filled: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(filled ? colors.textOnPrimary : 'transparent'),
    borderColor: colors.textOnPrimary,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/act-indicator.tsx
git commit -m "feat(presentation): add act indicator dots"
```

---

### Task 7: Control Bar Component

**Files:**
- Create: `src/features/presentation/components/control-bar.tsx`

**Interfaces:**
- Consumes: `currentAct: number`, `totalActs: number`, `isPaused: boolean`, `onPrev: () => void`, `onNext: () => void`, `onTogglePause: () => void`
- Produces: `<ControlBar ... />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/control-bar.tsx
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActIndicator } from './act-indicator';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type ControlBarProps = {
  currentAct: number;
  totalActs: number;
  isPaused: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
};

export function ControlBar({
  currentAct,
  totalActs,
  isPaused,
  onPrev,
  onNext,
  onTogglePause,
}: ControlBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={100}
      tint="systemMaterial"
      style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}
    >
      <View style={styles.content}>
        <ControlButton
          icon="chevron-left"
          onPress={onPrev}
          disabled={currentAct <= 1}
        />

        <ActIndicator currentAct={currentAct} totalActs={totalActs} />

        <ControlButton
          icon="chevron-right"
          onPress={onNext}
          disabled={currentAct >= totalActs}
        />

        <View style={styles.divider} />

        <ControlButton
          icon={isPaused ? 'play' : 'pause'}
          onPress={onTogglePause}
        />
      </View>
    </BlurView>
  );
}

type ControlButtonProps = {
  icon: 'chevron-left' | 'chevron-right' | 'play' | 'pause';
  onPress: () => void;
  disabled?: boolean;
};

function ControlButton({ icon, onPress, disabled }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={disabled ? colors.textSecondary : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/control-bar.tsx
git commit -m "feat(presentation): add control bar with blur"
```

---

### Task 8: Spotlight Overlay Component

**Files:**
- Create: `src/features/presentation/components/spotlight-overlay.tsx`

**Interfaces:**
- Consumes: `target: string | null`, `children: ReactNode`
- Produces: `<SpotlightOverlay target="recommendation-card">{...}</SpotlightOverlay>`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/spotlight-overlay.tsx
import { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

export type SpotlightOverlayProps = PropsWithChildren<{
  active: boolean;
}>;

/**
 * Overlay escuro sobre toda a tela.
 *
 * Quando `active` é true, o overlay aparece com opacity 0.6.
 * Os filhos são renderizados normalmente sobre o overlay.
 *
 * O spotlight "buraco" para elementos específicos será implementado
 * via z-index elevado nos componentes que devem ficar destacados,
 * já que SVG masks têm performance ruim no React Native.
 */
export function SpotlightOverlay({ active, children }: SpotlightOverlayProps) {
  const opacity = useDerivedValue(() => {
    return withTiming(active ? 0.6 : 0, { duration: 300 });
  }, [active]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={active ? 'auto' : 'none'}
      />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/spotlight-overlay.tsx
git commit -m "feat(presentation): add spotlight overlay"
```

---

### Task 9: Intro Screen Component

**Files:**
- Create: `src/features/presentation/components/intro-screen.tsx`

**Interfaces:**
- Consumes: `visible: boolean`
- Produces: `<IntroScreen visible={currentAct === 1} />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/intro-screen.tsx
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { SPRING_CONFIG } from '../animations/spring-entrance';

export type IntroScreenProps = {
  visible: boolean;
};

export function IntroScreen({ visible }: IntroScreenProps) {
  const logoScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Logo aparece com bounce
      logoScale.value = withSpring(1, SPRING_CONFIG);
      // Título após 500ms
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
      // Subtítulo após 1000ms
      subtitleOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));
    } else {
      logoScale.value = 0;
      titleOpacity.value = 0;
      subtitleOpacity.value = 0;
    }
  }, [visible, logoScale, titleOpacity, subtitleOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <MaterialCommunityIcons
            name="compass-rose"
            size={80}
            color={colors.primary}
          />
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text variant="title" align="center">
            ATLAS
          </Text>
        </Animated.View>

        <Animated.View style={subtitleStyle}>
          <Text variant="heading" color="textSecondary" align="center">
            Copiloto Inteligente de Viagem
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/intro-screen.tsx
git commit -m "feat(presentation): add intro screen with animations"
```

---

### Task 10: Animated Counter Component

**Files:**
- Create: `src/features/presentation/components/animated-counter.tsx`

**Interfaces:**
- Consumes: `value: number`, `format: (n: number) => string`
- Produces: `<AnimatedCounter value={116} format={formatDistance} />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/animated-counter.tsx
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { TextInput, StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type AnimatedCounterProps = {
  value: number;
  format: (value: number) => string;
  duration?: number;
};

export function AnimatedCounter({
  value,
  format,
  duration = 1000,
}: AnimatedCounterProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  const animatedProps = useAnimatedProps(() => {
    const current = Math.round(animatedValue.value);
    return {
      text: format(current),
      defaultValue: format(current),
    };
  });

  return (
    <AnimatedTextInput
      editable={false}
      style={styles.text}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.metric,
    color: colors.text,
    textAlign: 'center',
    padding: 0,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/animated-counter.tsx
git commit -m "feat(presentation): add animated counter component"
```

---

### Task 11: usePresentation Hook

**Files:**
- Create: `src/features/presentation/hooks/use-presentation.ts`
- Test: `src/features/presentation/hooks/use-presentation.test.ts`

**Interfaces:**
- Consumes: `PresentationState` from state store
- Produces: `usePresentation(): { currentAct, isPaused, caption, nextAct, prevAct, togglePause, goToAct }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/presentation/hooks/use-presentation.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresentation } from './use-presentation';
import { resetPresentation } from '../state/presentation-state';

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  notificationAsync: vi.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('usePresentation', () => {
  beforeEach(() => {
    resetPresentation();
  });

  it('starts at act 1', () => {
    const { result } = renderHook(() => usePresentation());
    expect(result.current.currentAct).toBe(1);
  });

  it('nextAct advances to next act', () => {
    const { result } = renderHook(() => usePresentation());
    act(() => {
      result.current.nextAct();
    });
    expect(result.current.currentAct).toBe(2);
  });

  it('prevAct goes back', () => {
    const { result } = renderHook(() => usePresentation());
    act(() => {
      result.current.goToAct(3);
    });
    act(() => {
      result.current.prevAct();
    });
    expect(result.current.currentAct).toBe(2);
  });

  it('cannot go before act 1', () => {
    const { result } = renderHook(() => usePresentation());
    act(() => {
      result.current.prevAct();
    });
    expect(result.current.currentAct).toBe(1);
  });

  it('cannot go past act 7', () => {
    const { result } = renderHook(() => usePresentation());
    act(() => {
      result.current.goToAct(7);
    });
    act(() => {
      result.current.nextAct();
    });
    expect(result.current.currentAct).toBe(7);
  });

  it('togglePause toggles isPaused', () => {
    const { result } = renderHook(() => usePresentation());
    expect(result.current.isPaused).toBe(false);
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.isPaused).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/presentation/hooks/use-presentation.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/presentation/hooks/use-presentation.ts
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

import { ACTS, getAct } from '../constants/acts';
import {
  usePresentationState,
  setPresentationState,
} from '../state/presentation-state';

const TOTAL_ACTS = ACTS.length;

export function usePresentation() {
  const state = usePresentationState();

  const nextAct = useCallback(() => {
    if (state.currentAct < TOTAL_ACTS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPresentationState({ currentAct: state.currentAct + 1 });
    }
  }, [state.currentAct]);

  const prevAct = useCallback(() => {
    if (state.currentAct > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPresentationState({ currentAct: state.currentAct - 1 });
    }
  }, [state.currentAct]);

  const goToAct = useCallback((act: number) => {
    if (act >= 1 && act <= TOTAL_ACTS) {
      setPresentationState({ currentAct: act });
    }
  }, []);

  const togglePause = useCallback(() => {
    setPresentationState({ isPaused: !state.isPaused });
  }, [state.isPaused]);

  const setCaption = useCallback((caption: string | null) => {
    setPresentationState({ caption });
  }, []);

  const setSpotlight = useCallback((target: string | null) => {
    setPresentationState({ spotlightTarget: target });
  }, []);

  const currentActData = getAct(state.currentAct);

  return {
    currentAct: state.currentAct,
    currentActData,
    isPaused: state.isPaused,
    caption: state.caption,
    spotlightTarget: state.spotlightTarget,
    totalActs: TOTAL_ACTS,
    nextAct,
    prevAct,
    goToAct,
    togglePause,
    setCaption,
    setSpotlight,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/presentation/hooks/use-presentation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/presentation/hooks/use-presentation.ts src/features/presentation/hooks/use-presentation.test.ts
git commit -m "feat(presentation): add usePresentation hook"
```

---

### Task 12: useActRunner Hook

**Files:**
- Create: `src/features/presentation/hooks/use-act-runner.ts`

**Interfaces:**
- Consumes: `Act`, `isPaused: boolean`, callbacks for actions
- Produces: `useActRunner(act, isPaused, callbacks): { isRunning: boolean }`

- [ ] **Step 1: Write the hook**

```typescript
// src/features/presentation/hooks/use-act-runner.ts
import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

import type { Act, ActStep, HapticStyle } from '../constants/acts';
import { setPresentationState } from '../state/presentation-state';

export type ActCallbacks = {
  onDemoResume?: () => void;
  onDemoPause?: () => void;
  onTriggerRecommendation?: () => void;
  onSimulateTap?: (target: string) => void;
  onAutoType?: (text: string, field: string) => void;
  onNavigate?: (to: string) => void;
  onCompleteTrip?: () => void;
  onActComplete?: () => void;
};

const HAPTIC_MAP: Record<HapticStyle, (() => Promise<void>) | null> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  none: null,
};

export function useActRunner(
  act: Act | undefined,
  isPaused: boolean,
  callbacks: ActCallbacks
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIndexRef = useRef(0);
  const isRunningRef = useRef(false);

  const clearCurrentTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const executeStep = useCallback(
    async (step: ActStep): Promise<void> => {
      switch (step.type) {
        case 'wait':
          return new Promise((resolve) => {
            timeoutRef.current = setTimeout(resolve, step.ms);
          });

        case 'caption':
          setPresentationState({ caption: step.text });
          break;

        case 'spotlight':
          setPresentationState({ spotlightTarget: step.target });
          break;

        case 'haptic':
          const hapticFn = HAPTIC_MAP[step.style];
          if (hapticFn) await hapticFn();
          break;

        case 'demo-resume':
          callbacks.onDemoResume?.();
          break;

        case 'demo-pause':
          callbacks.onDemoPause?.();
          break;

        case 'trigger-recommendation':
          callbacks.onTriggerRecommendation?.();
          break;

        case 'simulate-tap':
          callbacks.onSimulateTap?.(step.target);
          break;

        case 'auto-type':
          callbacks.onAutoType?.(step.text, step.field);
          break;

        case 'navigate':
          callbacks.onNavigate?.(step.to);
          break;

        case 'complete-trip':
          callbacks.onCompleteTrip?.();
          break;
      }
    },
    [callbacks]
  );

  const runSequence = useCallback(async () => {
    if (!act || isPaused) return;

    isRunningRef.current = true;

    for (let i = stepIndexRef.current; i < act.sequence.length; i++) {
      if (isPaused) {
        stepIndexRef.current = i;
        return;
      }

      await executeStep(act.sequence[i]);
      stepIndexRef.current = i + 1;
    }

    isRunningRef.current = false;
    callbacks.onActComplete?.();
  }, [act, isPaused, executeStep, callbacks]);

  // Reset when act changes
  useEffect(() => {
    clearCurrentTimeout();
    stepIndexRef.current = 0;
    isRunningRef.current = false;
    runSequence();

    return clearCurrentTimeout;
  }, [act?.id, clearCurrentTimeout, runSequence]);

  // Resume when unpaused
  useEffect(() => {
    if (!isPaused && act && stepIndexRef.current > 0) {
      runSequence();
    }
  }, [isPaused, act, runSequence]);

  return {
    isRunning: isRunningRef.current,
    currentStep: stepIndexRef.current,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/hooks/use-act-runner.ts
git commit -m "feat(presentation): add useActRunner hook for sequence execution"
```

---

### Task 13: Presentation Overlay Component

**Files:**
- Create: `src/features/presentation/components/presentation-overlay.tsx`

**Interfaces:**
- Consumes: demo drive controls, recommendation trigger, navigation
- Produces: `<PresentationOverlay demoDrive={...} ... />`

- [ ] **Step 1: Write the component**

```typescript
// src/features/presentation/components/presentation-overlay.tsx
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { CaptionBar } from './caption-bar';
import { ControlBar } from './control-bar';
import { IntroScreen } from './intro-screen';
import { SpotlightOverlay } from './spotlight-overlay';
import { usePresentation } from '../hooks/use-presentation';
import { useActRunner, type ActCallbacks } from '../hooks/use-act-runner';
import { resetPresentation } from '../state/presentation-state';
import type { DemoDrive } from '@/features/demo/hooks/use-demo-drive';
import { setDemoScenario } from '@/features/demo/state/demo-scenario';

export type PresentationOverlayProps = {
  demoDrive: DemoDrive;
  onTriggerRecommendation: () => void;
  onAcceptRecommendation: () => void;
  onSelectPlace: (index: number) => void;
  onCompleteTrip: () => void;
};

export function PresentationOverlay({
  demoDrive,
  onTriggerRecommendation,
  onAcceptRecommendation,
  onSelectPlace,
  onCompleteTrip,
}: PresentationOverlayProps) {
  const router = useRouter();
  const {
    currentAct,
    currentActData,
    isPaused,
    caption,
    spotlightTarget,
    totalActs,
    nextAct,
    prevAct,
    togglePause,
  } = usePresentation();

  // Reset presentation state on mount
  useEffect(() => {
    resetPresentation();
    return () => {
      resetPresentation();
    };
  }, []);

  const callbacks: ActCallbacks = {
    onDemoResume: useCallback(() => {
      if (demoDrive.isPaused) demoDrive.togglePause();
    }, [demoDrive]),

    onDemoPause: useCallback(() => {
      if (!demoDrive.isPaused) demoDrive.togglePause();
    }, [demoDrive]),

    onTriggerRecommendation: useCallback(() => {
      // Set scenario to trigger recommendation
      setDemoScenario({
        hour: 15,
        tripMinutes: 240,
        distanceKm: 190,
        minutesSinceStop: 180,
        emotion: 'cansado',
        imageClass: 'estrada',
      });
      onTriggerRecommendation();
    }, [onTriggerRecommendation]),

    onSimulateTap: useCallback(
      (target: string) => {
        if (target === 'accept-button') {
          onAcceptRecommendation();
        } else if (target.startsWith('place-row-')) {
          const index = parseInt(target.replace('place-row-', ''), 10);
          onSelectPlace(index);
        }
      },
      [onAcceptRecommendation, onSelectPlace]
    ),

    onNavigate: useCallback(
      (to: string) => {
        router.push(to as any);
      },
      [router]
    ),

    onCompleteTrip,

    onActComplete: useCallback(() => {
      // Auto-advance to next act after sequence completes
      if (currentAct < totalActs) {
        nextAct();
      }
    }, [currentAct, totalActs, nextAct]),
  };

  useActRunner(currentActData, isPaused, callbacks);

  // Tap anywhere to advance
  const tapGesture = Gesture.Tap().onEnd(() => {
    nextAct();
  });

  // Swipe left to go back
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-50, 50])
    .onEnd((event) => {
      if (event.translationX > 50) {
        prevAct();
      }
    });

  const composedGesture = Gesture.Race(tapGesture, swipeGesture);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Intro screen for Act 1 */}
      <IntroScreen visible={currentAct === 1} />

      {/* Spotlight overlay for highlighting elements */}
      <SpotlightOverlay active={spotlightTarget !== null}>
        {null}
      </SpotlightOverlay>

      {/* Caption bar at top */}
      {currentAct !== 1 && <CaptionBar text={caption} />}

      {/* Gesture area for tap/swipe */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gestureArea} />
      </GestureDetector>

      {/* Control bar at bottom */}
      <ControlBar
        currentAct={currentAct}
        totalActs={totalActs}
        isPaused={isPaused}
        onPrev={prevAct}
        onNext={nextAct}
        onTogglePause={togglePause}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  gestureArea: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/components/presentation-overlay.tsx
git commit -m "feat(presentation): add main presentation overlay component"
```

---

### Task 14: Create Feature Index

**Files:**
- Create: `src/features/presentation/index.ts`

**Interfaces:**
- Produces: public exports for the presentation feature

- [ ] **Step 1: Write the index**

```typescript
// src/features/presentation/index.ts
export { PresentationOverlay } from './components/presentation-overlay';
export { usePresentation } from './hooks/use-presentation';
export { resetPresentation } from './state/presentation-state';
export { ACTS, getAct } from './constants/acts';
export type { Act, ActStep } from './constants/acts';
```

- [ ] **Step 2: Commit**

```bash
git add src/features/presentation/index.ts
git commit -m "feat(presentation): add feature index exports"
```

---

### Task 15: Integrate Presentation Mode into Trip Screen

**Files:**
- Modify: `src/app/trip.tsx`

**Interfaces:**
- Consumes: `PresentationOverlay` from presentation feature
- Produces: presentation mode when `?presentation=1` URL param

- [ ] **Step 1: Read current trip.tsx** (already read above)

- [ ] **Step 2: Add presentation mode detection and overlay**

Add imports at top of file:
```typescript
import { PresentationOverlay } from '@/features/presentation';
```

Add presentation mode detection after line 109:
```typescript
const { demo: demoParam, presentation: presentationParam } = useLocalSearchParams<{
  demo?: string;
  presentation?: string;
}>();
const isDemo = demoParam === '1';
const isPresentation = presentationParam === '1';

// Presentation mode implies demo mode
const effectiveDemo = isDemo || isPresentation;
```

Replace `isDemo` usages with `effectiveDemo` where appropriate.

Add callback refs for presentation actions:
```typescript
const presentationAcceptRef = useRef<() => void>(() => {});
const presentationSelectPlaceRef = useRef<(index: number) => void>(() => {});

// Update refs when handlers change
useEffect(() => {
  presentationAcceptRef.current = () => answerRecommendation(true);
}, [answerRecommendation]);

useEffect(() => {
  presentationSelectPlaceRef.current = (index: number) => {
    const places = stopOptions.result?.places;
    if (places && places[index]) {
      chooseStop(places[index]);
    }
  };
}, [stopOptions.result, chooseStop]);
```

Add overlay before closing `</View>` of screen:
```typescript
{isPresentation && (
  <PresentationOverlay
    demoDrive={demoDrive}
    onTriggerRecommendation={askRecommendation}
    onAcceptRecommendation={() => presentationAcceptRef.current()}
    onSelectPlace={(index) => presentationSelectPlaceRef.current(index)}
    onCompleteTrip={concludeDemoTrip}
  />
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/trip.tsx
git commit -m "feat(trip): integrate presentation mode overlay"
```

---

### Task 16: Add testID to RecommendationCard

**Files:**
- Modify: `src/features/recommendation/components/recommendation-card.tsx`

**Interfaces:**
- Consumes: existing props
- Produces: testID attributes for presentation mode targeting

- [ ] **Step 1: Add testIDs to the component**

Add testID to the main card View:
```typescript
<View style={[styles.card, shadows.raised]} testID="recommendation-card">
```

Add testID to the Accept button:
```typescript
<PrimaryButton
  label="Aceitar"
  showChevron={false}
  onPress={onAccept}
  testID="accept-button"
/>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/recommendation/components/recommendation-card.tsx
git commit -m "feat(recommendation): add testID for presentation mode"
```

---

### Task 17: Add testID to NearbyOptions

**Files:**
- Modify: `src/features/nearby/components/nearby-options.tsx`

**Interfaces:**
- Produces: testID attributes on place rows

- [ ] **Step 1: Read the file**

Run: Read the nearby-options.tsx file to understand its structure.

- [ ] **Step 2: Add testID to place rows**

Add testID prop to each place row item:
```typescript
testID={`place-row-${index}`}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/nearby/components/nearby-options.tsx
git commit -m "feat(nearby): add testID to place rows for presentation"
```

---

### Task 18: Run Full Verification

**Files:** All modified/created files

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors (or only warnings)

- [ ] **Step 4: Test presentation mode manually**

Run app with: `expo start`
Navigate to: `atlas://trip?presentation=1`
Verify:
- Intro screen shows with logo animation
- Acts progress automatically
- Control bar works (prev/next/pause)
- Captions appear with blur
- Demo drive pauses/resumes correctly

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: address verification issues"
```

---

## Summary

This plan creates a professional presentation mode with:

1. **State management** - External store for presentation state
2. **Act definitions** - 7 acts with sequences of steps
3. **Animations** - Spring entrance, glow pulse, counters
4. **Native iOS components** - Blur overlays (caption, controls)
5. **Sequence runner** - Executes steps with proper cleanup
6. **Integration** - Hooks into existing demo mode

Total: 18 tasks, ~150 lines of test code, ~800 lines of implementation.
