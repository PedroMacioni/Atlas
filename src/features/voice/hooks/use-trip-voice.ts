import { useCallback } from 'react';

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
  /** "Preciso abastecer ou descansar": pede avaliação ao Random Forest. */
  askRecommendation: () => void;
  registerTouristSpot: () => Promise<void>;
  /** Busca as 3 opções de uma categoria — elas serão lidas em voz alta. */
  findStop: (category: NearbyCategory) => void;
  openEmergency: () => void;
  endTrip: () => void;
  /** Todo comando ouvido vai para o diário de bordo (§7.1). */
  recordCommand: (transcript: string) => void;
  /** O áudio da fala, para a análise de emoção. */
  onAudio?: (uri: string) => void;
};

export type TripVoice = Voice & {
  /** Toque no microfone: começa a ouvir, ou encerra a escuta em curso. */
  onMicPress: () => void;
};

const HELP =
  'Você pode dizer: registrar parada, preciso abastecer ou descansar, ' +
  'quero um posto, registrar ponto turístico, emergência, ou encerrar viagem.';

/**
 * Comandos de voz durante a viagem (RF-11, RF-12, §3.1).
 *
 * Um toque no microfone, uma frase, uma ação — e o Atlas responde falando
 * (RF-20). Encerrar a viagem pede confirmação por voz (RF-25). O que precisa
 * de escolha (as 3 opções de uma parada) segue na tela, que lê as opções.
 */
export function useTripVoice(actions: TripVoiceActions): TripVoice {
  const voice = useVoice();
  const { say, listen, state, finish } = voice;

  const run = useCallback(async () => {
    const heard = await listen();

    if (!heard) {
      return;
    }

    if (heard.audioUri) {
      actions.onAudio?.(heard.audioUri);
    }

    if (!heard.transcript) {
      await say('Não ouvi nada.');
      return;
    }

    actions.recordCommand(heard.transcript);
    const command = parseCommand(heard.transcript);

    switch (command.type) {
      case 'register_stop':
        try {
          await actions.registerStop();
          await say('Parada registrada.');
        } catch (cause) {
          await say(cause instanceof Error ? cause.message : 'Não consegui registrar a parada.');
        }
        return;

      case 'need_rest_or_fuel':
        await say('Vou avaliar a sua viagem.');
        actions.askRecommendation();
        return;

      case 'register_tourist_spot':
        try {
          await actions.registerTouristSpot();
          await say('Ponto turístico registrado.');
        } catch {
          await say('Não consegui registrar o ponto turístico.');
        }
        return;

      case 'go_category':
      case 'add_stop':
        await say(`Vou buscar ${CATEGORY_SPEECH[command.category]} perto de você.`);
        actions.findStop(command.category);
        return;

      case 'emergency':
        await say('Abrindo a emergência.');
        actions.openEmergency();
        return;

      case 'unwell':
        await say('Vou mostrar os hospitais mais próximos e os números de emergência.');
        actions.openEmergency();
        return;

      case 'end_trip': {
        const confirmed = await confirmByVoice(voice, 'Quer encerrar a viagem?');
        if (confirmed) {
          actions.endTrip();
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
    // `actions` é recriado a cada renderização; lido no momento do comando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen, say]);

  const onMicPress = useCallback(() => {
    if (state === 'listening') {
      finish();
      return;
    }
    if (state === 'idle') {
      run().catch(() => {});
    }
  }, [state, finish, run]);

  return { ...voice, onMicPress };
}
