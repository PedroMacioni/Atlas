import { osrmRouteProvider } from '@/features/routing/providers/osrm-route-provider';
import type { GetRouteParams, RouteProvider } from '@/features/routing/types/route-provider';
import type { RouteResult } from '@/features/routing/types/route-result';

/**
 * Ponto único de acesso a rotas.
 *
 * A interface só conhece `getRoute`. Qual provider responde é decidido aqui —
 * hoje o OSRM público de demonstração, amanhã Google Routes ou Mapbox, sem que
 * nenhum componente precise ser alterado.
 */
let activeProvider: RouteProvider = osrmRouteProvider;

/** Substitui o provider em uso (produção, testes ou feature flag). */
export function setRouteProvider(provider: RouteProvider): void {
  activeProvider = provider;
}

/** Provider atualmente ativo — útil para diagnóstico e telas de debug. */
export function getRouteProviderId(): string {
  return activeProvider.id;
}

export function getRoute(params: GetRouteParams): Promise<RouteResult> {
  return activeProvider.getRoute(params);
}
