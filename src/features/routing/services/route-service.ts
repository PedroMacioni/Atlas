import { isAtlasApiConfigured } from '@/config/api';
import { atlasRouteProvider } from '@/features/routing/providers/atlas-route-provider';
import { osrmRouteProvider } from '@/features/routing/providers/osrm-route-provider';
import type { GetRouteParams, RouteProvider } from '@/features/routing/types/route-provider';
import type { RouteResult } from '@/features/routing/types/route-result';

/**
 * Ponto único de acesso a rotas.
 *
 * A interface só conhece `getRoute`. Qual provider responde é decidido aqui:
 * a API do Atlas quando existe uma configurada, e o OSRM público direto quando
 * não existe.
 *
 * A escolha por configuração, e não por `__DEV__`, é deliberada: quem abre o
 * projeto e roda `npx expo start` sem subir o backend continua vendo o
 * aplicativo funcionar de ponta a ponta. Definir `EXPO_PUBLIC_ATLAS_API_URL`
 * é o que move as chamadas para o servidor — sem tocar em nenhuma tela.
 */
let activeProvider: RouteProvider = isAtlasApiConfigured()
  ? atlasRouteProvider
  : osrmRouteProvider;

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
