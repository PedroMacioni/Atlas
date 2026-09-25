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
  /** `false` no Expo Go (não tem reconhecimento de fala). A voz de saída funciona. */
  available: boolean;
  state: VoiceState;
  /** O texto parcial enquanto a pessoa fala. */
  partial: string;
  error: string | null;
  /** Fala o texto e só termina quando a fala acaba. */
  say: (text: string) => Promise<void>;
  /** Ouve uma fala. `null` quando falhou ou foi cancelada. */
  listen: (options?: Omit<ListenOptions, 'onPartial'>) => Promise<Heard | null>;
  /** Para de ouvir aproveitando o que já foi dito. */
  finish: () => void;
  cancel: () => void;
};

/**
 * Estado da conversa por voz de uma tela.
 *
 * Falar e ouvir nunca acontecem juntos: `say` só termina quando a fala acaba,
 * e só depois a conversa chama `listen`. Sair da tela cancela os dois.
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
