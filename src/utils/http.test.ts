import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError, fetchJson } from '@/utils/http';

/**
 * Um `fetch` falso que se comporta como o de verdade: se o sinal já estiver
 * cancelado, a chamada falha; senão, devolve `{ ok: true }`.
 */
function stubFetch() {
  const fake = vi.fn((_url: string, init?: RequestInit) =>
    init?.signal?.aborted
      ? Promise.reject(new Error('aborted'))
      : Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
  vi.stubGlobal('fetch', fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('devolve o corpo em JSON', async () => {
    stubFetch();

    await expect(fetchJson('https://api.test/x')).resolves.toEqual({ ok: true });
  });

  it('não faz a chamada com um sinal que já veio cancelado', async () => {
    stubFetch();
    const controller = new AbortController();
    controller.abort();

    const promise = fetchJson('https://api.test/x', { signal: controller.signal });

    await expect(promise).rejects.toBeInstanceOf(HttpError);
    await expect(promise).rejects.toMatchObject({ kind: 'network', message: 'Requisição cancelada.' });
  });

  it('traz o código de erro da API do Atlas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'route_not_found', message: 'Sem rota.' } }), {
            status: 404,
          }),
        ),
      ),
    );

    await expect(fetchJson('https://api.test/x')).rejects.toMatchObject({
      kind: 'status',
      status: 404,
      code: 'route_not_found',
    });
  });
});
