import { isAtlasApiConfigured } from '@/config/api';
import { atlasRouteProvider } from '@/features/routing/providers/atlas-route-provider';
import { osrmRouteProvider } from '@/features/routing/providers/osrm-route-provider';
import type { GetRouteParams, RouteProvider } from '@/features/routing/types/route-provider';
import type { RouteResult } from '@/features/routing/types/route-result';

/**
 * Ponto único para pedir rotas.
 *
 * As telas só chamam `getRoute`. Qual serviço responde é decidido aqui: a API
 * do Atlas quando ela está configurada, ou o OSRM público direto quando não.
 * Assim o app funciona mesmo sem o backend rodando.
 */
let activeProvider: RouteProvider = isAtlasApiConfigured()
  ? atlasRouteProvider
  : osrmRouteProvider;

/** Troca o serviço de rotas em uso (útil em testes). */
export function setRouteProvider(provider: RouteProvider): void {
  activeProvider = provider;
}

/** Id do serviço de rotas em uso (mostrado na aba Sobre). */
export function getRouteProviderId(): string {
  return activeProvider.id;
}

export function getRoute(params: GetRouteParams): Promise<RouteResult> {
  return activeProvider.getRoute(params);
}
