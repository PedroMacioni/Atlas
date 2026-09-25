import { useCallback } from 'react';

import type { NearbyCategory } from '@/features/nearby/types/nearby';
import { useVoice, type Voice } from '@/features/voice/hooks/use-voice';
import { parseCommand, type VoiceCommand } from '@/features/voice/utils/command-parser';

export type HomeVoiceActions = {
  /** Abre Definir destino já buscando a categoria, com as opções lidas. */
  goCategory: (category: NearbyCategory) => void;
  /** Abre Definir destino já buscando o lugar pelo nome. */
  goPlace: (query: string) => void;
  openEmergency: () => void;
};

export type HomeVoice = Voice & {
  onMicPress: () => void;
  /**
   * Continua a conversa a partir do que a escuta contínua ouviu (CA-02).
   *
   * `rest` é o que veio depois de "Atlas": se tiver um comando, ele é executado;
   * se estiver vazio, o Atlas pergunta para onde ir.
   */
  resume: (rest: string) => void;
};

/**
 * Conversa por voz na tela inicial (RF-03, RF-05, RF-06, §3.1).
 *
 *     — Atlas.
 *     — Para onde você quer ir?
 *     — O posto mais próximo.
 *     → abre "Definir destino" buscando postos e lê as 3 opções.
 *
 * Também aceita tudo de uma vez: "Atlas, quero ir para o posto mais próximo".
 */
export function useHomeVoice(actions: HomeVoiceActions): HomeVoice {
  const voice = useVoice();
  const { say, listen, state, finish } = voice;

  const act = useCallback(
    async (command: VoiceCommand): Promise<boolean> => {
      switch (command.type) {
        case 'go_category':
        case 'add_stop':
          actions.goCategory(command.category);
          return true;
        case 'go_place':
          actions.goPlace(command.query);
          return true;
        case 'emergency':
        case 'unwell':
          await say('Abrindo a emergência.');
          actions.openEmergency();
          return true;
        case 'register_stop':
        case 'register_tourist_spot':
        case 'need_rest_or_fuel':
        case 'end_trip':
          await say('Esse comando é para durante a viagem. Primeiro, diga para onde você quer ir.');
          return true;
        default:
          return false;
      }
    },
    // `actions` é lido na hora do comando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say],
  );

  const run = useCallback(
    async (heardAlready?: string) => {
      let spoken = heardAlready ?? '';

      if (!spoken) {
        const first = await listen();

        if (!first) {
          // Falha de microfone ou permissão: a mensagem já aparece na tela.
          return;
        }

        if (!first.transcript) {
          // Silêncio vira uma resposta falada, e não o microfone fechando sem aviso.
          await say('Não ouvi nada. Toque de novo e diga para onde você quer ir.');
          return;
        }

        spoken = first.transcript;
      }

      const command = parseCommand(spoken);
      if (await act(command)) {
        return;
      }

      // Só "Atlas", "destino" ou algo não entendido: o Atlas pergunta.
      await say(
        command.type === 'ask_destination'
          ? 'Para onde você quer ir?'
          : 'Não entendi. Para onde você quer ir? Diga, por exemplo: o posto mais próximo.',
      );

      const second = await listen();
      if (!second?.transcript) {
        await say('Não ouvi nada.');
        return;
      }

      const answer = parseCommand(second.transcript);
      if (!(await act(answer))) {
        // Sem categoria nem comando: o que foi dito é o nome do lugar.
        actions.goPlace(second.transcript);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listen, say, act],
  );

  const onMicPress = useCallback(() => {
    if (state === 'listening') {
      finish();
      return;
    }
    if (state === 'idle') {
      run().catch(() => {});
    }
  }, [state, finish, run]);

  const resume = useCallback(
    (rest: string) => {
      if (state === 'idle') {
        run(rest).catch(() => {});
      }
    },
    [state, run],
  );

  return { ...voice, onMicPress, resume };
}
