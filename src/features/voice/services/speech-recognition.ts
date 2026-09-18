import { requireOptionalNativeModule } from 'expo';
// Só tipos: `import type` some no bundle, então não exige o módulo nativo.
import type {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionNativeEventMap,
} from 'expo-speech-recognition';

type SpeechModule = typeof ExpoSpeechRecognitionModule;

/**
 * Reconhecimento de fala no próprio iPhone, pelo reconhecedor da Apple.
 *
 * O módulo é nativo e **não existe no Expo Go** — só num development build
 * (`eas build --profile development`). Por isso ele não é importado direto:
 * o `import` do pacote exige o módulo e derrubaria o app no Expo Go. Aqui ele
 * é pedido com `requireOptionalNativeModule`, e a ausência vira
 * `isVoiceAvailable() === false` — o microfone some e o resto do app segue.
 *
 * A mesma fala é gravada em arquivo (`recordingOptions.persist`): o texto vai
 * para os comandos, e o áudio vai para a análise de emoção no backend.
 *
 * @see https://github.com/jamsch/expo-speech-recognition
 */
const native = requireOptionalNativeModule<SpeechModule>(
  'ExpoSpeechRecognition',
);

export function isVoiceAvailable(): boolean {
  return native !== null;
}

export type Heard = {
  /** O que foi dito, já final. Vazio quando ninguém falou. */
  transcript: string;
  /** Arquivo com o áudio da fala, para a análise de emoção. */
  audioUri: string | null;
};

export type ListenOptions = {
  /** Texto parcial enquanto a pessoa fala, para a tela acompanhar. */
  onPartial?: (text: string) => void;
  /**
   * Palavras que o reconhecedor deve favorecer — os comandos do Atlas e os
   * nomes das opções na tela, que nem sempre estão no vocabulário comum.
   */
  hints?: string[];
};

export class VoiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

const COMMAND_HINTS = [
  'Atlas',
  'registrar parada',
  'registrar ponto turístico',
  'preciso abastecer ou descansar',
  'encerrar viagem',
  'adicionar parada',
  'emergência',
];

const MESSAGES: Record<string, string> = {
  'not-allowed': 'O Atlas não tem permissão para usar o microfone ou o reconhecimento de fala.',
  'language-not-supported': 'O reconhecimento em português não está disponível neste aparelho.',
  network: 'O reconhecimento de fala precisa de internet neste aparelho.',
  'audio-capture': 'Não foi possível usar o microfone agora.',
  interrupted: 'O microfone foi interrompido (ligação, Siri ou alarme).',
  busy: 'O reconhecimento de fala está ocupado. Tente de novo.',
};

let active: Promise<Heard> | null = null;

/**
 * Ouve **uma** fala e devolve o texto final e o áudio.
 *
 * Termina sozinho quando a pessoa para de falar. `stopListening()` encerra
 * antes, aproveitando o que já foi dito.
 */
export function listenOnce({ onPartial, hints = [] }: ListenOptions = {}): Promise<Heard> {
  if (!native) {
    return Promise.reject(new VoiceError('unavailable', 'Voz indisponível neste build.'));
  }

  if (active) {
    return active;
  }

  const module = native;

  active = (async () => {
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      throw new VoiceError('not-allowed', MESSAGES['not-allowed']);
    }

    return new Promise<Heard>((resolve, reject) => {
      let transcript = '';
      let audioUri: string | null = null;
      let failure: VoiceError | null = null;

      const subscriptions = [
        module.addListener('result', (event: ExpoSpeechRecognitionNativeEventMap['result']) => {
          const text = event.results[0]?.transcript ?? '';
          if (event.isFinal) {
            transcript = text;
          } else {
            onPartial?.(text);
          }
        }),
        module.addListener('audioend', (event: ExpoSpeechRecognitionNativeEventMap['audioend']) => {
          audioUri = event.uri ?? null;
        }),
        module.addListener('error', (event: ExpoSpeechRecognitionNativeEventMap['error']) => {
          // "Ninguém falou" não é falha: é uma resposta vazia.
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            failure = new VoiceError(event.error, MESSAGES[event.error] ?? event.message);
          }
        }),
        module.addListener('end', () => {
          subscriptions.forEach((subscription) => subscription.remove());
          if (failure) {
            reject(failure);
          } else {
            resolve({ transcript: transcript.trim(), audioUri });
          }
        }),
      ];

      module.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
        // Não exige o reconhecimento só no aparelho: se o iPhone não tiver o
        // pacote de português baixado, a escuta falharia inteira. Com `false`
        // o iOS usa o aparelho quando pode e a rede quando precisa.
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: [...COMMAND_HINTS, ...hints].slice(0, 100),
        iosTaskHint: 'unspecified',
        // Alto-falante do aparelho, e não o de ligação: depois de ouvir, o
        // Atlas responde falando, e a resposta tem que ser audível no carro.
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'measurement',
        },
        recordingOptions: { persist: true },
      });
    });
  })().finally(() => {
    active = null;
  });

  return active;
}

/** Encerra a escuta agora, aproveitando o que já foi dito. */
export function stopListening(): void {
  native?.stop();
}

/** Cancela a escuta sem processar nada. */
export function abortListening(): void {
  native?.abort();
}
