import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
// Só tipos: `import type` some no bundle, então não exige o módulo nativo.
import type {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionNativeEventMap,
} from 'expo-speech-recognition';

import { findWakeWord } from '@/features/voice/utils/command-parser';

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

/**
 * Folga entre uma sessão de vigília e a seguinte.
 *
 * Reabrir no mesmo instante em que o sistema fechou dá "busy" no Android e
 * uma sessão morta no iOS.
 */
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

  // Só uma sessão de reconhecimento existe por vez: a vigília sai de cena
  // enquanto o comando é ouvido, e volta sozinha no fim.
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
        O último texto parcial, guardado como rede de segurança.

        Uma fala curta — "Atlas", "sim", "o primeiro" — às vezes encerra a
        sessão sem que o resultado **final** chegue: o reconhecedor entrega só
        parciais e fecha. Sem isto, o Atlas devolvia texto vazio e a conversa
        morria em silêncio, com o microfone fechando sem explicação.
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
            resolve({ transcript: (transcript || lastPartial).trim(), audioUri });
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

    if (watching) {
      startWakeWordWatch(watchOptions);
    }
  });

  return active;
}

/**
 * Escuta contínua da palavra "Atlas" (RF-02, CA-02).
 *
 * Uma sessão de reconhecimento fica aberta ouvindo o carro; cada trecho
 * reconhecido é lido de passagem e descartado — nada é gravado nem enviado
 * enquanto a palavra não aparece. Quando aparece, a vigília para e quem
 * chamou assume: o Atlas responde e escuta o comando.
 *
 * A sessão precisa ser reaberta sozinha. O reconhecedor do sistema encerra
 * por conta própria — no iOS há um limite de cerca de um minuto por sessão,
 * e em qualquer plataforma um silêncio longo termina a escuta.
 */
export type WakeWordOptions = {
  /** Chamado com o que foi dito **depois** da palavra, que pode ser vazio. */
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
        // "Ninguém falou" é o caso comum de um carro em silêncio: a sessão
        // termina e a próxima começa. Um erro de permissão, não.
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        stopped = true;
        options.onError?.(new VoiceError(event.error, MESSAGES[event.error] ?? event.message));
      }),
      module.addListener('end', () => {
        subscriptions.forEach((subscription) => subscription.remove());

        if (!stopped) {
          // Reabre em seguida, com uma folga para o áudio do sistema fechar.
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
      // A vigília não guarda áudio: o que se ouve de passagem não é comando
      // e não deve virar arquivo no aparelho.
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
 * Devolve a sessão de áudio do iOS ao estado de **falar**.
 *
 * A escuta abre a sessão em `playAndRecord` com o modo `measurement`, que é o
 * certo para reconhecer fala e o errado para reproduzi-la: depois de ouvir, a
 * voz do Atlas sai baixa ou não sai. Chamado antes de cada fala.
 *
 * Só existe no iOS. Em qualquer outro caso, não faz nada — e uma falha aqui
 * nunca impede o Atlas de tentar falar.
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
    // Sessão ocupada por uma ligação, por exemplo: falar baixo é melhor que
    // não falar.
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
