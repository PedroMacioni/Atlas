import { useCallback, useEffect, useRef } from 'react';

import type { NearbyCategory } from '@/features/nearby/types/nearby';
import { useVoice, type Voice } from '@/features/voice/hooks/use-voice';
import { parseCommand } from '@/features/voice/utils/command-parser';
import { confirmByVoice } from '@/features/voice/utils/voice-dialogs';

const CATEGORY_SPEECH: Record<NearbyCategory, string> = {
  posto: 'postos',
  restaurante: 'restaurantes',
  hotel: 'hotéis',
  ponto_turistico: 'pontos turísticos',
  hospital: 'hospitais',
  descanso: 'lugares para descansar',
  parada: 'lugares para uma parada',
};

export type TripVoiceActions = {
  registerStop: () => Promise<void>;
  /** "Preciso abastecer ou descansar": pede uma avaliação ao Random Forest. */
  askRecommendation: () => void;
  describeTripProgress: () => string;
  registerTouristSpot: () => Promise<void>;
  /** Busca as 3 opções de uma categoria (elas serão lidas em voz alta). */
  findStop: (category: NearbyCategory) => void;
  openEmergency: () => void;
  endTrip: () => void;
  /** Todo comando ouvido vai para o diário (§7.1), com o áudio (de onde sai a emoção, RF-15). */
  recordCommand: (transcript: string, audioUri: string | null) => void;
};

export type TripVoice = Voice & {
  /** Toque no microfone: começa a ouvir, ou encerra a escuta em curso. */
  onMicPress: () => void;
  /** Continua a partir do que a escuta contínua ouviu (CA-02). */
  resume: (rest: string) => void;
  /** Executa um comando pronto (modo apresentação), sem gravar fala falsa no diário. */
  demoCommand: (command: string) => Promise<void>;
};

const HELP =
  'Você pode dizer: registrar parada, preciso abastecer ou descansar, ' +
  'quero um posto, quanto falta, registrar ponto turístico, emergência, ou encerrar viagem.';

/**
 * Comandos de voz durante a viagem (RF-11, RF-12, §3.1).
 *
 * Um toque no microfone, uma frase, uma ação, e o Atlas responde falando
 * (RF-20). Encerrar a viagem pede confirmação por voz (RF-25).
 */
export function useTripVoice(actions: TripVoiceActions): TripVoice {
  const voice = useVoice();
  const { say, listen, state, finish } = voice;
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const run = useCallback(
    async (heardAlready?: string, record = true) => {
      const currentActions = actionsRef.current;
      let spoken = heardAlready ?? '';

      if (!spoken) {
        const heard = await listen();

        if (!heard) {
          return;
        }

        if (!heard.transcript) {
          await say('Não ouvi nada.');
          return;
        }

        // O comando vai para o diário com o áudio (de onde sai a emoção).
        if (record) currentActions.recordCommand(heard.transcript, heard.audioUri);
        spoken = heard.transcript;
      } else {
        if (record) currentActions.recordCommand(spoken, null);
      }

      const command = parseCommand(spoken);

      switch (command.type) {
        case 'register_stop':
          try {
            await currentActions.registerStop();
            await say('Parada registrada.');
          } catch (cause) {
            await say(cause instanceof Error ? cause.message : 'Não consegui registrar a parada.');
          }
          return;

        case 'need_rest_or_fuel':
          await say('Vou avaliar a sua viagem.');
          currentActions.askRecommendation();
          return;

        case 'trip_status':
          await say(currentActions.describeTripProgress());
          return;

        case 'register_tourist_spot':
          try {
            await currentActions.registerTouristSpot();
            await say('Ponto turístico registrado.');
          } catch {
            await say('Não consegui registrar o ponto turístico.');
          }
          return;

        case 'go_category':
        case 'add_stop':
          await say(`Vou buscar ${CATEGORY_SPEECH[command.category]} perto de você.`);
          currentActions.findStop(command.category);
          return;

        case 'emergency':
          await say('Abrindo a emergência.');
          currentActions.openEmergency();
          return;

        case 'unwell':
          await say('Vou mostrar os hospitais mais próximos e os números de emergência.');
          currentActions.openEmergency();
          return;

        case 'end_trip': {
          const confirmed = await confirmByVoice({ say, listen }, 'Quer encerrar a viagem?');
          if (confirmed) {
            currentActions.endTrip();
          } else if (confirmed === false) {
            await say('Tudo bem, seguimos viagem.');
          }
          return;
        }

        case 'ask_destination':
        case 'go_place':
          await say(
            'Durante a viagem eu busco paradas no caminho. Diga, por exemplo: quero um posto.',
          );
          return;

        default:
          await say(`Não entendi. ${HELP}`);
      }
    },
    [listen, say],
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

  const demoCommand = useCallback((command: string) => run(command, false), [run]);

  return { ...voice, onMicPress, resume, demoCommand };
}
