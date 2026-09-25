/**
 * Camada HTTP do app, usando o `fetch` nativo (sem Axios).
 *
 * Todas as chamadas de rede passam por aqui, para que tempo limite, falta de
 * rede, status de erro e resposta inválida sejam tratados sempre do mesmo jeito.
 */

/** Tipos de falha de uma requisição. */
export type HttpErrorKind = 'timeout' | 'network' | 'status' | 'invalid-response';

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly status?: number;
  /**
   * Código de erro devolvido pela API do Atlas (ex.: `route_not_found`).
   * Não existe quando o erro veio de outro serviço ou da própria rede.
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

/** Formato de erro da API do Atlas: `{ error: { code, message } }`. */
type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown };
};

/**
 * Lê o erro da API sem nunca falhar por causa dele (um servidor que responde
 * HTML no lugar de JSON não pode causar um segundo erro).
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
  /**
   * Corpo da requisição. Vai como JSON, exceto `FormData`, que vai como
   * multipart (usado para enviar foto e áudio).
   */
  body?: unknown;
  /** Cabeçalhos extras (ex.: o id do aparelho). */
  headers?: Record<string, string>;
};

/**
 * Faz a requisição e devolve o corpo já convertido de JSON.
 *
 * Sempre lança `HttpError` (nunca o erro cru do `fetch`), para as telas
 * decidirem a mensagem a partir de `error.kind`.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, method = 'GET', body, headers } = options;

  // Com `FormData` o próprio `fetch` monta o cabeçalho `content-type` (com o
  // separador do multipart). Definir na mão quebraria o envio.
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Se quem chamou cancelar, cancela esta requisição também.
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);
  // O evento 'abort' não dispara de novo para um sinal que já veio cancelado.
  if (signal?.aborted) {
    controller.abort();
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(body === undefined || isMultipart ? null : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
    });
  } catch {
    if (controller.signal.aborted) {
      // Cancelamento pedido por quem chamou não é falha de rede.
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
    // O `code` do erro da API é mais útil que o status HTTP para escolher a mensagem.
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
