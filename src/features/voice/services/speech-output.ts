import * as Speech from 'expo-speech';

import { prepareAudioForSpeaking } from '@/features/voice/services/speech-recognition';

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

/**
 * Teto para a espera pelo fim da fala.
 *
 * `onDone` nem sempre chega: com o aparelho no silencioso, ou com a sessão de
 * áudio ainda presa no modo do reconhecimento de fala, o `expo-speech` fica
 * mudo e não avisa. Sem este teto a conversa inteira parava ali — o microfone
 * fechava e nada mais acontecia.
 *
 * O valor acompanha o tamanho do texto: ~90 ms por caractere é mais lento que
 * qualquer locução real, com um piso de 2 s e um teto de 15 s.
 */
const MS_PER_CHARACTER = 90;
const MIN_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 15_000;
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

  // Depois de ouvir, a sessão de áudio do iOS fica no modo de reconhecimento,
  // em que a fala sai baixa ou não sai.
  prepareAudioForSpeaking();
  Speech.stop();

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        clearTimeout(timeoutId);
        resolve();
      }
    };

    const timeoutId = setTimeout(
      finish,
      Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, text.length * MS_PER_CHARACTER)),
    );

    Speech.speak(text, {
      language: LANGUAGE,
      voice: identifier,
      rate: 1.0,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
