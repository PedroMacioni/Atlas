/**
 * Trechos de conversa que se repetem: ler as 3 opções e escolher uma por voz
 * (RF-13, RF-14) e confirmar com "sim" ou "não" (CA-10, RF-25).
 *
 * Recebem `say` e `listen` por parâmetro, para qualquer tela poder usar.
 */

import type { NearbyPlace } from '@/features/nearby/types/nearby';
import { matchOptionByName, parseCommand } from '@/features/voice/utils/command-parser';
import type { Voice } from '@/features/voice/hooks/use-voice';

type Talk = Pick<Voice, 'say' | 'listen'>;

const NUMBERS = ['Um', 'Dois', 'Três'];

/** Quantas opções a voz lê (uma lista de 10 falada ninguém guarda na cabeça). */
const SPOKEN_OPTIONS = NUMBERS.length;

function spokenDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 50) * 50} metros`;
  }
  const km = (meters / 1000).toFixed(1).replace('.', ',').replace(',0', '');
  return `${km} ${km === '1' ? 'quilômetro' : 'quilômetros'}`;
}

function spokenDuration(seconds: number | null): string {
  if (seconds === null) {
    return '';
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `, ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/** "Um: Posto Taquaral, a 1,5 quilômetros, 3 minutos, nota 4,6." */
export function describeOptions(places: NearbyPlace[]): string {
  return places
    .map((place, index) => {
      const rating =
        place.rating !== null ? `, nota ${place.rating.toFixed(1).replace('.', ',')}` : '';
      return `${NUMBERS[index]}: ${place.name}, a ${spokenDistance(place.distanceMeters)}${spokenDuration(place.durationSeconds)}${rating}.`;
    })
    .join(' ');
}

/**
 * Lê as opções e pergunta qual. Aceita número ("o segundo") ou nome ("o
 * Taquaral"); se não entender, pergunta mais uma vez. Devolve o índice, ou
 * `null` se a pessoa recusou ou não respondeu.
 */
export async function chooseOptionByVoice(
  { say, listen }: Talk,
  places: NearbyPlace[],
  intro: string,
): Promise<number | null> {
  places = places.slice(0, SPOKEN_OPTIONS);

  if (places.length === 0) {
    await say('Não encontrei nenhuma opção por perto.');
    return null;
  }

  await say(`${intro} ${describeOptions(places)} Qual você escolhe?`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const heard = await listen({ hints: places.map((place) => place.name) });
    if (!heard?.transcript) {
      return null;
    }

    const command = parseCommand(heard.transcript, 'choice');
    if (command.type === 'no') {
      await say('Tudo bem.');
      return null;
    }

    const index =
      command.type === 'choose'
        ? command.index
        : matchOptionByName(
            heard.transcript,
            places.map((place) => place.name),
          );

    if (index !== null && index < places.length) {
      await say(`${places[index].name}. Certo.`);
      return index;
    }

    if (attempt === 0) {
      await say('Não entendi. Diga o número da opção: um, dois ou três.');
    }
  }

  return null;
}

/** Pergunta e espera "sim" ou "não". `null` quando não houve resposta clara. */
export async function confirmByVoice({ say, listen }: Talk, question: string): Promise<boolean | null> {
  await say(question);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const heard = await listen();
    if (!heard?.transcript) {
      return null;
    }

    const command = parseCommand(heard.transcript, 'confirmation');
    if (command.type === 'yes') return true;
    if (command.type === 'no') return false;

    if (attempt === 0) {
      await say('Não entendi. Responda sim ou não.');
    }
  }

  return null;
}
