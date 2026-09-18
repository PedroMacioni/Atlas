import * as Speech from 'expo-speech';

/**
 * A voz do Atlas (RF-20): recomendações e confirmações faladas em voz alta.
 *
 * O escopo pede voz masculina (§3.1). Os sistemas não marcam gênero nas vozes
 * de forma padronizada, então a escolha é por nome: entre as vozes em
 * português do Brasil, a primeira cujo identificador sugere voz masculina.
 * Sem nenhuma, fica a voz padrão pt-BR do aparelho — falar com a voz errada é
 * melhor que não falar.
 *
 * No iOS, com o aparelho no modo silencioso, o `expo-speech` não produz som.
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/speech/
 */

const LANGUAGE = 'pt-BR';
const MALE_HINTS = /\b(male|masculin[oa]?|felipe|ricardo|daniel|antonio|thiago|bruno)\b|-ptd-|#male/i;
const FEMALE_HINTS = /female|feminin/i;

let voice: Promise<string | undefined> | null = null;

function pickVoice(): Promise<string | undefined> {
  voice ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const brazilian = voices.filter((item) => item.language.replace('_', '-') === LANGUAGE);
      const male = brazilian.find(
        (item) =>
          MALE_HINTS.test(`${item.identifier} ${item.name}`) &&
          !FEMALE_HINTS.test(`${item.identifier} ${item.name}`),
      );
      return male?.identifier;
    })
    .catch(() => undefined);

  return voice;
}

/**
 * Fala o texto, interrompendo o que estiver sendo falado, e resolve quando a
 * fala **termina**.
 *
 * Esperar o fim importa: a conversa por voz fala e depois escuta, e abrir o
 * microfone com o Atlas ainda falando faria ele ouvir a si mesmo.
 */
export async function speak(text: string): Promise<void> {
  const identifier = await pickVoice();

  Speech.stop();

  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: LANGUAGE,
      voice: identifier,
      rate: 1.0,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
