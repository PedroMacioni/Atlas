/**
 * Endereço da API do Atlas.
 *
 * Vem de `EXPO_PUBLIC_ATLAS_API_URL`, lida do `.env` pelo Expo CLI e inlinada
 * no bundle em tempo de build. A referência precisa ser literal — o Expo
 * substitui `process.env.EXPO_PUBLIC_*` estaticamente, então desestruturar ou
 * usar índice não funciona.
 *
 * Nada sensível passa por aqui: uma variável `EXPO_PUBLIC_` fica visível em
 * texto puro no aplicativo compilado. É justamente por isso que a URL da API
 * mora aqui e as **chaves** moram no backend.
 *
 * Sem a variável definida, o aplicativo continua funcionando como na fase
 * anterior: rotas direto do OSRM e lugares da lista local.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */
const RAW_BASE_URL = process.env.EXPO_PUBLIC_ATLAS_API_URL;

/** URL sem barra final, ou `null` quando a API não foi configurada. */
export const ATLAS_API_BASE_URL: string | null = normalize(RAW_BASE_URL);

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

/** `true` quando existe um backend para conversar. */
export function isAtlasApiConfigured(): boolean {
  return ATLAS_API_BASE_URL !== null;
}

/**
 * Monta uma URL da API.
 *
 * Lança se chamada sem configuração — quem chama deve consultar
 * `isAtlasApiConfigured()` antes, e o erro existe para que uma chamada
 * esquecida apareça em desenvolvimento em vez de virar `undefined/v1/routes`.
 */
export function atlasApiUrl(path: string): string {
  if (ATLAS_API_BASE_URL === null) {
    throw new Error(
      'EXPO_PUBLIC_ATLAS_API_URL não está definida — a API do Atlas não foi configurada.',
    );
  }

  return `${ATLAS_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
