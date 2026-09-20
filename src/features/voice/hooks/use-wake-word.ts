import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isVoiceAvailable,
  startWakeWordWatch,
  stopWakeWordWatch,
} from '@/features/voice/services/speech-recognition';

export type WakeWordState = {
  /** `false` no Expo Go, onde não há reconhecimento de fala. */
  available: boolean;
  /** `true` quando o Atlas está ouvindo o carro esperando pelo nome. */
  watching: boolean;
  /** O último trecho ouvido de passagem, para a tela mostrar atenção. */
  heard: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
};

export type WakeWordParams = {
  /**
   * Chamado quando "Atlas" é ouvido, com o que veio depois — vazio quando a
   * pessoa só chamou pelo nome.
   */
  onWake: (rest: string) => void;
  /** Desliga a vigília sem desmontar a tela (durante uma conversa, por ex.). */
  enabled?: boolean;
};

/**
 * "Diga Atlas para começar", de verdade (RF-02, CA-02).
 *
 * Fica desligada até alguém ligar: uma escuta contínua gasta bateria e ouve
 * tudo o que se fala no carro, e isso é escolha de quem dirige, não padrão do
 * aplicativo. Enquanto está ligada, nada do que se ouve é gravado ou enviado
 * — só o trecho reconhecido é lido em memória à procura do nome.
 *
 * Enquanto um comando está sendo ouvido, a vigília sai de cena sozinha: o
 * reconhecedor do sistema só aceita uma sessão por vez.
 */
export function useWakeWord({ onWake, enabled = true }: WakeWordParams): WakeWordState {
  const [watching, setWatching] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Lido no momento em que a palavra aparece, e não quando a vigília começa.
  const latest = useRef(onWake);

  useEffect(() => {
    latest.current = onWake;
  }, [onWake]);

  const stop = useCallback(() => {
    stopWakeWordWatch();
    setWatching(false);
    setHeard('');
  }, []);

  const toggle = useCallback(() => {
    setError(null);
    setWatching((current) => !current);
  }, []);

  useEffect(() => {
    if (!watching || !enabled) {
      stopWakeWordWatch();
      return;
    }

    startWakeWordWatch({
      onWake: (rest) => {
        setWatching(false);
        setHeard('');
        latest.current(rest);
      },
      onHeard: (text) => setHeard(text.slice(-60)),
      onError: (cause) => {
        setWatching(false);
        setError(cause.message);
      },
    });

    return stopWakeWordWatch;
  }, [watching, enabled]);

  return {
    available: isVoiceAvailable(),
    watching,
    heard,
    error,
    toggle,
    stop,
  };
}
