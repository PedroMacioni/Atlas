/**
 * Flags de funcionalidade do Atlas.
 *
 * Como em `api.ts`, os valores vêm de variáveis `EXPO_PUBLIC_` inlinadas no
 * bundle em tempo de build — a referência a `process.env` precisa ser literal.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */

/**
 * `EXPO_PUBLIC_DEV_MODE=true` libera as ferramentas de desenvolvimento que não
 * devem aparecer para quem usa o aplicativo — hoje, o modo apresentação.
 * Desligada por padrão: sem a variável, nada disso existe no app.
 */
export const DEV_MODE = isTruthy(process.env.EXPO_PUBLIC_DEV_MODE);

function isTruthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}
