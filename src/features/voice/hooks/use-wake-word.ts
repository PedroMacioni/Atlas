import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isVoiceAvailable,
  startWakeWordWatch,
  stopWakeWordWatch,
} from '@/features/voice/services/speech-recognition';

export type WakeWordState = {
  /** `false` no Expo Go (não tem reconhecimento de fala). */
  available: boolean;
  /** `true` quando o Atlas está ouvindo, esperando alguém dizer "Atlas". */
  watching: boolean;
  /** O último trecho ouvido. */
  heard: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
};

export type WakeWordParams = {
  /** Chamado quando "Atlas" é ouvido, com o que veio depois (vazio se só chamou o nome). */
  onWake: (rest: string) => void;
  /** Desliga a escuta sem fechar a tela (por exemplo, durante uma conversa). */
  enabled?: boolean;
};

/**
 * Escuta contínua da palavra "Atlas" (RF-02, CA-02).
 *
 * Fica desligada até o usuário ligar, porque gasta bateria e ouve tudo no
 * carro. Enquanto ligada, nada é gravado nem enviado: o texto reconhecido só
 * é conferido na memória, procurando o nome.
 *
 * Durante um comando a escuta contínua pausa sozinha, porque o sistema só
 * permite uma sessão de reconhecimento por vez.
 */
export function useWakeWord({ onWake, enabled = true }: WakeWordParams): WakeWordState {
  const [watching, setWatching] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Lido na hora em que a palavra aparece.
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
