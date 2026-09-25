/**
 * Endereço da API do Atlas.
 *
 * Vem da variável `EXPO_PUBLIC_ATLAS_API_URL` (arquivo `.env`). O Expo coloca
 * o valor dentro do app na hora do build, por isso a leitura precisa ser
 * escrita exatamente como `process.env.EXPO_PUBLIC_...`.
 *
 * Tudo que é `EXPO_PUBLIC_` fica visível dentro do app, então aqui vai só a
 * URL. As chaves de API ficam no backend.
 *
 * Sem a variável, o app funciona sozinho: rotas direto do OSRM e lugares de
 * uma lista local.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */
const RAW_BASE_URL = process.env.EXPO_PUBLIC_ATLAS_API_URL;

/** URL sem barra no final, ou `null` quando a API não foi configurada. */
export const ATLAS_API_BASE_URL: string | null = normalize(RAW_BASE_URL);

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

/** `true` quando existe um backend configurado. */
export function isAtlasApiConfigured(): boolean {
  return ATLAS_API_BASE_URL !== null;
}

/**
 * Monta uma URL da API.
 *
 * Dá erro se a API não estiver configurada. Quem chama deve checar
 * `isAtlasApiConfigured()` antes; o erro existe para o esquecimento aparecer
 * logo no desenvolvimento.
 */
export function atlasApiUrl(path: string): string {
  if (ATLAS_API_BASE_URL === null) {
    throw new Error(
      'EXPO_PUBLIC_ATLAS_API_URL não está definida — a API do Atlas não foi configurada.',
    );
  }

  return `${ATLAS_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
