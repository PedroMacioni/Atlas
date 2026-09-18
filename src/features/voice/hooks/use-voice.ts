import { useCallback, useEffect, useState } from 'react';

import {
  abortListening,
  isVoiceAvailable,
  listenOnce,
  stopListening,
  type Heard,
  type ListenOptions,
} from '@/features/voice/services/speech-recognition';
import { speak, stopSpeaking } from '@/features/voice/services/speech-output';

export type VoiceState = 'idle' | 'listening' | 'speaking';

export type Voice = {
  /** `false` no Expo Go — o microfone não aparece. A voz de saída funciona. */
  available: boolean;
  state: VoiceState;
  /** O que está sendo dito agora, antes do resultado final. */
  partial: string;
  error: string | null;
  /** Fala e resolve quando terminou de falar. */
  say: (text: string) => Promise<void>;
  /** Ouve uma fala. `null` quando falhou ou foi cancelada. */
  listen: (options?: Omit<ListenOptions, 'onPartial'>) => Promise<Heard | null>;
  /** Encerra a escuta aproveitando o que foi dito (toque no microfone de novo). */
  finish: () => void;
  cancel: () => void;
};

/**
 * Estado da conversa por voz de uma tela.
 *
 * Fala e escuta nunca se sobrepõem: `say` resolve quando a fala termina, e só
 * então quem conduz a conversa chama `listen`. Sair da tela cancela as duas.
 */
export function useVoice(): Voice {
  const [state, setState] = useState<VoiceState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  const say = useCallback(async (text: string) => {
    setState('speaking');
    try {
      await speak(text);
    } finally {
      setState('idle');
    }
  }, []);

  const listen = useCallback(async (options: Omit<ListenOptions, 'onPartial'> = {}) => {
    setError(null);
    setPartial('');
    setState('listening');

    try {
      return await listenOnce({ ...options, onPartial: setPartial });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ouvir agora.');
      return null;
    } finally {
      setState('idle');
      setPartial('');
    }
  }, []);

  const cancel = useCallback(() => {
    abortListening();
    stopSpeaking();
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    available: isVoiceAvailable(),
    state,
    partial,
    error,
    say,
    listen,
    finish: stopListening,
    cancel,
  };
}
