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
  /**
   * Código de domínio devolvido pela API do Atlas — `route_not_found`,
   * `route_provider_timeout` e afins. Ausente quando o erro veio de outro
   * serviço ou da própria rede.
   */
  readonly code?: string;

  constructor(kind: HttpErrorKind, message: string, status?: number, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/** Formato de erro da API do Atlas. */
type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown };
};

/**
 * Lê o envelope de erro sem nunca falhar por causa dele.
 *
 * Um serviço que responde 500 com HTML não pode transformar o tratamento de
 * erro em um segundo erro.
 */
async function readErrorEnvelope(
  response: Response,
): Promise<{ code?: string; message?: string } | null> {
  try {
    const payload = (await response.json()) as ErrorEnvelope;
    const failure = payload?.error;

    if (!failure) {
      return null;
    }

    return {
      code: typeof failure.code === 'string' ? failure.code : undefined,
      message: typeof failure.message === 'string' ? failure.message : undefined,
    };
  } catch {
    return null;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

export type FetchJsonOptions = {
  /** Tempo máximo até abortar a requisição. Padrão: 12 s. */
  timeoutMs?: number;
  /** Sinal externo, para cancelar quando a tela é desmontada. */
  signal?: AbortSignal;
  /** Verbo HTTP. Padrão: `GET`. */
  method?: 'GET' | 'POST';
  /** Corpo da requisição, serializado como JSON. */
  body?: unknown;
  /** Cabeçalhos extras — o identificador do aparelho, por exemplo. */
  headers?: Record<string, string>;
};

/**
 * Busca uma URL e devolve o corpo já desserializado como JSON.
 *
 * Lança sempre `HttpError`, nunca um erro cru do `fetch`, para que as camadas
 * acima possam decidir a mensagem de interface a partir de `error.kind`.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, method = 'GET', body, headers } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Encadeia um eventual cancelamento externo no mesmo controller.
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? null : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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
    // A API do Atlas responde erro com `{ error: { code, message } }`. O código
    // é estável e vale mais que o status: é ele que escolhe a mensagem de tela.
    const failure = await readErrorEnvelope(response);

    throw new HttpError(
      'status',
      failure?.message ?? `Resposta HTTP inesperada: ${response.status}.`,
      response.status,
      failure?.code,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError('invalid-response', 'O serviço devolveu um corpo que não é JSON válido.');
  }
}
