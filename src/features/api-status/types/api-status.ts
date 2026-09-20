/** O formato de `GET /health`. */
export type ApiHealth = {
  status: 'ok' | 'degraded';
  version: string;
  environment: string;
  routeProvider: string;
  database: boolean;
  /** Versão do Random Forest, ou `null` se o modelo não foi treinado. */
  model: string | null;
  /** Estado do classificador de imagem. */
  vision: 'ready' | 'loading' | 'off';
};
