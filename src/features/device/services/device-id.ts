import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Identificador anônimo do aparelho (escopo §8).
 *
 * O Atlas não tem login. Na primeira vez o app gera um UUID, guarda no
 * armazenamento seguro do celular e envia em toda chamada de viagem. É por
 * ele que o backend separa o histórico de cada aparelho.
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/crypto/
 */
const STORAGE_KEY = 'atlas.device-id';

/** Lê uma vez só por execução; todas as chamadas usam a mesma promessa. */
let pending: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  pending ??= loadOrCreate().catch((error: unknown) => {
    // Se falhar, a próxima chamada tenta de novo.
    pending = null;
    throw error;
  });

  return pending;
}

async function loadOrCreate(): Promise<string> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEY);

  if (stored) {
    return stored;
  }

  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(STORAGE_KEY, created);
  return created;
}
