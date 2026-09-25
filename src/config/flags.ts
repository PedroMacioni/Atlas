/**
 * Chaves (flags) de funcionalidade do app.
 *
 * Como em `api.ts`, os valores vêm de variáveis `EXPO_PUBLIC_` do `.env`.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */

/**
 * `EXPO_PUBLIC_DEV_MODE=true` libera ferramentas de desenvolvimento que o
 * usuário comum não deve ver (hoje, o modo apresentação). Desligada por padrão.
 */
export const DEV_MODE = isTruthy(process.env.EXPO_PUBLIC_DEV_MODE);

function isTruthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}
