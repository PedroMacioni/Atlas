/**
 * Camada HTTP mínima do Atlas.
 *
 * Usa o `fetch` nativo do React Native (sem Axios). Todo acesso de rede do
 * aplicativo passa por aqui para que timeout, erro de rede, status inesperado
 * e corpo inválido tenham sempre o mesmo tratamento.
 */

/** Motivos pelos quais uma requisição pode falhar, já classificados. */
export type HttpErrorKind = 'timeout' | 'network' | 'status' | 'invalid-response';

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly status?: number;

  constructor(kind: HttpErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

export type FetchJsonOptions = {
  /** Tempo máximo até abortar a requisição. Padrão: 12 s. */
  timeoutMs?: number;
  /** Sinal externo, para cancelar quando a tela é desmontada. */
  signal?: AbortSignal;
};

/**
 * Busca uma URL e devolve o corpo já desserializado como JSON.
 *
 * Lança sempre `HttpError`, nunca um erro cru do `fetch`, para que as camadas
 * acima possam decidir a mensagem de interface a partir de `error.kind`.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Encadeia um eventual cancelamento externo no mesmo controller.
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  let response: Response;

  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
  } catch {
    if (controller.signal.aborted) {
      // Cancelamento pedido por quem chamou não é uma falha da rede.
      if (signal?.aborted) {
        throw new HttpError('network', 'Requisição cancelada.');
      }
      throw new HttpError('timeout', `Tempo limite de ${timeoutMs} ms excedido.`);
    }
    throw new HttpError('network', 'Não foi possível conectar ao serviço.');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    throw new HttpError('status', `Resposta HTTP inesperada: ${response.status}.`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError('invalid-response', 'O serviço devolveu um corpo que não é JSON válido.');
  }
}
