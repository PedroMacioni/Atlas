# Navegação 3D - Plano de Implementação

> **For agentic workers:** Use superpowers:executing-plans

**Goal:** Estender AtlasMap com visualização 3D e trajeto progressivo

**Spec:** `docs/superpowers/specs/2026-09-21-navigation-3d.md`

---

## Task 1: Utilitários Geo

**Files:**
- Create: `src/features/map/utils/geo.ts`
- Create: `src/features/map/utils/geo.test.ts`

**Produces:** `haversineDistance`, `calculateHeading`

---

## Task 2: Utilitários de Progresso

**Files:**
- Create: `src/features/map/utils/route-progress.ts`
- Create: `src/features/map/utils/route-progress.test.ts`

**Consumes:** `haversineDistance` from geo.ts
**Produces:** `findNearestPointOnRoute`, `calculateDistanceToEnd`

---

## Task 3: Constantes de Navegação

**Files:**
- Create: `src/features/map/constants/navigation.ts`

**Produces:** `NAVIGATION_CONFIG`, `ROUTE_COLORS`

---

## Task 4: Hook useNavigationProgress

**Files:**
- Create: `src/features/map/hooks/use-navigation-progress.ts`
- Create: `src/features/map/hooks/use-navigation-progress.test.ts`

**Consumes:** utils from Task 1-2, constants from Task 3
**Produces:** `useNavigationProgress` hook

---

## Task 5: Estender AtlasMap

**Files:**
- Modify: `src/features/map/components/atlas-map.tsx`

**Consumes:** constants from Task 3
**Produces:** AtlasMap com modo `focus="navigation"`

---

## Task 6: Verificação Final

- Build sem erros
- Testes passando
