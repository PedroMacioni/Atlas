import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
// Só tipos: `import type` não exige o módulo nativo.
import type {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionNativeEventMap,
} from 'expo-speech-recognition';

import { findWakeWord } from '@/features/voice/utils/command-parser';

type SpeechModule = typeof ExpoSpeechRecognitionModule;

/**
 * Reconhecimento de fala no próprio celular.
 *
 * O módulo é nativo e NÃO existe no Expo Go, só num development build
 * (`eas build --profile development`). Por isso é carregado com
 * `requireOptionalNativeModule`: se não existir, `isVoiceAvailable()` devolve
 * `false`, o microfone some e o resto do app continua.
 *
 * A fala também é gravada em arquivo (`recordingOptions.persist`): o texto vira
 * comando e o áudio vai para a análise de emoção no backend.
 *
 * @see https://github.com/jamsch/expo-speech-recognition
 */
const native = requireOptionalNativeModule<SpeechModule>(
  'ExpoSpeechRecognition',
);

export function isVoiceAvailable(): boolean {
  return native !== null;
}

/** Pausa entre uma sessão de escuta contínua e a próxima (reabrir na hora dá erro). */
const RESTART_DELAY_MS = 400;

export type Heard = {
  /** O que foi dito, já final. Vazio quando ninguém falou. */
  transcript: string;
  /** Arquivo com o áudio da fala, para a análise de emoção. */
  audioUri: string | null;
};

export type ListenOptions = {
  /** Texto parcial enquanto a pessoa fala, para a tela acompanhar. */
  onPartial?: (text: string) => void;
  /** Palavras que o reconhecedor deve favorecer: comandos do Atlas e nomes na tela. */
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
  'quanto falta para chegar',
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
 * Ouve UMA fala e devolve o texto final e o áudio.
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

  // Só uma sessão por vez: a escuta contínua pausa e volta sozinha no fim.
  const watching = watcher !== null;
  stopWakeWordWatch();

  active = (async () => {
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      throw new VoiceError('not-allowed', MESSAGES['not-allowed']);
    }

    return new Promise<Heard>((resolve, reject) => {
      let transcript = '';
      /*
        Último texto parcial, guardado como reserva: numa fala curta ("sim",
        "Atlas") às vezes o resultado final não chega, e sem isto a conversa
        morreria em silêncio.
      */
      let lastPartial = '';
      let audioUri: string | null = null;
      let failure: VoiceError | null = null;

      const subscriptions = [
        module.addListener('result', (event: ExpoSpeechRecognitionNativeEventMap['result']) => {
          const text = event.results[0]?.transcript ?? '';
          if (event.isFinal) {
            transcript = text;
          } else if (text) {
            lastPartial = text;
            onPartial?.(text);
          }
        }),
        module.addListener('audioend', (event: ExpoSpeechRecognitionNativeEventMap['audioend']) => {
          audioUri = event.uri ?? null;
        }),
        module.addListener('error', (event: ExpoSpeechRecognitionNativeEventMap['error']) => {
          // "Ninguém falou" não é erro: é uma resposta vazia.
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            failure = new VoiceError(event.error, MESSAGES[event.error] ?? event.message);
          }
        }),
        module.addListener('end', () => {
          subscriptions.forEach((subscription) => subscription.remove());
          if (failure) {
            reject(failure);
          } else {
            resolve({ transcript: (transcript || lastPartial).trim(), audioUri });
          }
        }),
      ];

      module.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
        // Usa o reconhecimento no aparelho quando der, e a internet quando precisar.
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: [...COMMAND_HINTS, ...hints].slice(0, 100),
        iosTaskHint: 'unspecified',
        // Alto-falante do celular (e não o de ligação), para a resposta ser ouvida no carro.
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

    if (watching) {
      startWakeWordWatch(watchOptions);
    }
  });

  return active;
}

/**
 * Escuta contínua da palavra "Atlas" (RF-02, CA-02).
 *
 * Uma sessão de reconhecimento fica aberta ouvindo o carro. Cada trecho é
 * conferido e descartado; nada é gravado nem enviado. Quando "Atlas" aparece,
 * a escuta para e a tela assume a conversa.
 *
 * O sistema fecha a sessão sozinho de tempos em tempos (no iOS, ~1 minuto),
 * então ela é reaberta automaticamente.
 */
export type WakeWordOptions = {
  /** Chamado com o que foi dito depois da palavra (pode ser vazio). */
  onWake: (rest: string) => void;
  /** Texto ouvido de passagem, para a tela mostrar que está atenta. */
  onHeard?: (text: string) => void;
  onError?: (error: VoiceError) => void;
};

type Watcher = { stop: () => void };

let watcher: Watcher | null = null;
let watchOptions: WakeWordOptions | null = null;

export function isWatchingForWakeWord(): boolean {
  return watcher !== null;
}

export function startWakeWordWatch(options: WakeWordOptions | null): void {
  if (!native || !options || watcher || active) {
    return;
  }

  const module = native;
  watchOptions = options;
  let stopped = false;

  const session = () => {
    if (stopped) {
      return;
    }

    const subscriptions = [
      module.addListener('result', (event: ExpoSpeechRecognitionNativeEventMap['result']) => {
        const text = event.results[0]?.transcript ?? '';

        if (!text) {
          return;
        }

        options.onHeard?.(text);
        const { found, rest } = findWakeWord(text);

        if (found) {
          stopped = true;
          module.abort();
          options.onWake(rest);
        }
      }),
      module.addListener('error', (event: ExpoSpeechRecognitionNativeEventMap['error']) => {
        // "Ninguém falou" é normal num carro em silêncio: a próxima sessão começa. Erro de permissão, não.
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        stopped = true;
        options.onError?.(new VoiceError(event.error, MESSAGES[event.error] ?? event.message));
      }),
      module.addListener('end', () => {
        subscriptions.forEach((subscription) => subscription.remove());

        if (!stopped) {
          // Reabre logo depois, com uma pausa para o áudio do sistema fechar.
          setTimeout(session, RESTART_DELAY_MS);
          return;
        }

        if (watcher?.stop === stop) {
          watcher = null;
        }
      }),
    ];

    module.start({
      lang: 'pt-BR',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      contextualStrings: COMMAND_HINTS.slice(0, 100),
      iosTaskHint: 'unspecified',
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
        mode: 'measurement',
      },
      // A escuta contínua não guarda áudio: o que se ouve de passagem não é comando.
      recordingOptions: { persist: false },
    });
  };

  const stop = () => {
    stopped = true;
    module.abort();
    watcher = null;
  };

  watcher = { stop };
  module.requestPermissionsAsync().then((permission) => {
    if (permission.granted) {
      session();
      return;
    }
    watcher = null;
    options.onError?.(new VoiceError('not-allowed', MESSAGES['not-allowed']));
  });
}

export function stopWakeWordWatch(): void {
  watcher?.stop();
  watcher = null;
}

/**
 * Volta o áudio do iOS para o modo de FALAR.
 *
 * A escuta deixa o áudio num modo bom para gravar e ruim para tocar (a voz do
 * Atlas sairia baixa). Chamado antes de cada fala. Só faz algo no iOS.
 */
export function prepareAudioForSpeaking(): void {
  if (Platform.OS !== 'ios' || !native) {
    return;
  }

  try {
    native.setCategoryIOS({
      category: 'playback',
      categoryOptions: ['duckOthers'],
      mode: 'spokenAudio',
    });
  } catch {
    // Áudio ocupado (ex.: ligação): falar baixo é melhor que não falar.
  }
}

/** Encerra a escuta agora, aproveitando o que já foi dito. */
export function stopListening(): void {
  native?.stop();
}

/** Cancela a escuta sem processar nada. */
export function abortListening(): void {
  native?.abort();
}
