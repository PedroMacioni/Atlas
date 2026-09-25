import * as Speech from 'expo-speech';

import { prepareAudioForSpeaking } from '@/features/voice/services/speech-recognition';

/**
 * A voz do Atlas (RF-20): recomendações e confirmações faladas.
 *
 * O escopo pede voz masculina (§3.1). Como os sistemas não marcam o gênero da
 * voz de forma padrão, procuramos pelo nome, entre as vozes pt-BR. Se não
 * achar, usa a voz padrão do aparelho.
 *
 * No iOS, com o celular no modo silencioso, não sai som.
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/speech/
 */

const LANGUAGE = 'pt-BR';

/**
 * Tempo máximo esperando a fala terminar.
 *
 * Às vezes o aviso de "terminou" não chega (celular no silencioso, por
 * exemplo). Sem este limite a conversa travaria. O tempo depende do tamanho
 * do texto (~90 ms por letra), entre 2 s e 15 s.
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
 * Fala o texto (interrompendo o que estiver falando) e só termina quando a
 * fala acaba. Isso evita abrir o microfone com o Atlas ainda falando.
 */
export async function speak(text: string): Promise<void> {
  const identifier = await pickVoice();

  // Depois de ouvir, o áudio do iOS fica no modo de gravação e a fala sai baixa.
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
