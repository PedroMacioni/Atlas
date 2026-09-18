import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Identificador anônimo do aparelho (escopo §8).
 *
 * O Atlas não tem login. Na primeira execução o aplicativo gera um UUID v4,
 * guarda no armazenamento seguro do sistema e o envia em toda chamada de
 * viagem — é por ele que o backend separa o histórico de cada aparelho.
 *
 * No Android o valor some com a desinstalação; no iOS ele sobrevive a uma
 * reinstalação com o mesmo bundle. Nos dois casos o histórico é "deste
 * aparelho, enquanto o app existir", que é o que o escopo pede.
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/crypto/
 */
const STORAGE_KEY = 'atlas.device-id';

/** Uma leitura só por execução: todas as chamadas compartilham a mesma promessa. */
let pending: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  pending ??= loadOrCreate().catch((error: unknown) => {
    // Falhou (armazenamento indisponível): a próxima chamada tenta de novo, em
    // vez de carregar a falha para sempre.
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
