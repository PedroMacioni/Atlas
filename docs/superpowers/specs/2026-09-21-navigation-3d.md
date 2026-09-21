# Navegação 3D com Trajeto Progressivo

**Data:** 2026-09-21
**Status:** Aprovado
**Projeto:** Atlas (Expo/React Native)

## Resumo

Estender o `AtlasMap` existente com:
1. **Visualização 3D estilo Waze** - câmera inclinada (pitch) e rotacionada conforme direção
2. **Trajeto progressivo** - trecho percorrido fica opaco, trecho pendente fica vibrante

## Contexto

- **Base existente:** `AtlasMap` em `src/features/map/components/atlas-map.tsx`
- **Biblioteca:** `react-native-maps` 1.27.2 (já instalada)
- **Tipo existente:** `Coordinate = { latitude, longitude }`
- **Focus existente:** `'route' | 'user'` - adicionar `'navigation'`

---

## 1. Mudanças no AtlasMap

### 1.1 Novas Props

```typescript
export type AtlasMapProps = {
  // ... props existentes ...

  /** Novo modo: 'navigation' ativa câmera 3D com pitch e heading */
  focus?: 'route' | 'user' | 'navigation';

  /** Heading do GPS em graus (0-360), usado no modo navigation */
  userHeading?: number | null;

  /** Índice do ponto atual na rota, para dividir completed/pending */
  routeProgressIndex?: number;
};
```

### 1.2 Comportamento do Modo Navigation

Quando `focus === 'navigation'`:
- Câmera usa `animateCamera` ao invés de `animateToRegion`
- `pitch: 60` (inclinação 3D)
- `heading` acompanha `userHeading` do GPS
- `zoom: 17` (aproximado para navegação)
- Polyline dividida em duas: completed (opaca) e pending (vibrante)

### 1.3 Câmera 3D

```typescript
// No modo navigation:
mapRef.current?.animateCamera({
  center: {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
  },
  pitch: 60,
  heading: userHeading ?? 0,
  zoom: 17,
}, { duration: 450 });
```

### 1.4 Polylines Progressivas

```typescript
const completedCoords = routeCoordinates.slice(0, routeProgressIndex + 1);
const pendingCoords = routeCoordinates.slice(routeProgressIndex);

// Completed: opaco
<Polyline
  coordinates={completedCoords}
  strokeColor={colors.primary}
  strokeWidth={6}
  strokeOpacity={0.3}
/>

// Pending: vibrante
<Polyline
  coordinates={pendingCoords}
  strokeColor={colors.primary}
  strokeWidth={6}
  strokeOpacity={1}
/>
```

---

## 2. Hook useNavigationProgress

Novo hook para calcular progresso na rota:

```typescript
// src/features/map/hooks/use-navigation-progress.ts

export function useNavigationProgress(
  userLocation: Coordinate | null,
  routeCoordinates: Coordinate[]
): {
  progressIndex: number;
  isOnRoute: boolean;
  distanceToDestination: number;
}
```

**Funcionalidade:**
- Encontra ponto mais próximo na rota
- Progresso só avança (nunca regride)
- Calcula distância restante
- Detecta se usuário está fora da rota (threshold: 50m)

---

## 3. Utilitários Geo

Adicionar em `src/features/map/utils/`:

```typescript
// geo.ts
export function haversineDistance(a: Coordinate, b: Coordinate): number;
export function calculateHeading(from: Coordinate, to: Coordinate): number | null;

// route-progress.ts
export function findNearestPointOnRoute(
  userPos: Coordinate,
  route: Coordinate[]
): { index: number; distance: number };
```

---

## 4. Constantes

Adicionar em `src/features/map/constants/navigation.ts`:

```typescript
export const NAVIGATION_CONFIG = {
  PITCH: 60,
  ZOOM: 17,
  ANIMATION_MS: 450,
  OFF_ROUTE_THRESHOLD: 50, // metros
  ARRIVED_THRESHOLD: 30,   // metros
  MIN_MOVEMENT_FOR_HEADING: 5, // metros
};

export const ROUTE_COLORS = {
  completed: { color: colors.primary, opacity: 0.3 },
  pending: { color: colors.primary, opacity: 1.0 },
};
```

---

## 5. Uso na Trip

O `trip.tsx` já usa `AtlasMap`. Para ativar navegação 3D:

```tsx
<AtlasMap
  focus="navigation"
  currentLocation={userLocation}
  userHeading={gpsHeading}
  routeProgressIndex={progressIndex}
  routeCoordinates={route}
  // ... outras props
/>
```

---

## 6. Estrutura de Arquivos

```
src/features/map/
├── components/
│   └── atlas-map.tsx          # Estender com modo navigation
├── constants/
│   ├── map-style.ts           # Existente
│   └── navigation.ts          # Novo: NAVIGATION_CONFIG
├── hooks/
│   └── use-navigation-progress.ts  # Novo
├── utils/
│   ├── geo.ts                 # Novo: haversine, heading
│   └── route-progress.ts      # Novo: findNearest
└── types/
    └── coordinate.ts          # Existente
```

---

## 7. Testes

- `geo.test.ts` - haversineDistance, calculateHeading
- `route-progress.test.ts` - findNearestPointOnRoute
- `use-navigation-progress.test.ts` - hook behavior
