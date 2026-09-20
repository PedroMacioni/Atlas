/**
 * Da fala para o comando (escopo §3.1, RF-11, RF-12).
 *
 * Regras em português, e não um modelo: previsíveis, testáveis e fáceis de
 * explicar na apresentação. O reconhecedor de fala entrega texto; aqui se
 * decide o que o texto pede.
 *
 * Função pura — sem React, sem microfone. Quem conversa com o usuário é
 * `use-voice-assistant`.
 */

import type { NearbyCategory } from '@/features/nearby/types/nearby';

export type VoiceCommand =
  /** "Atlas" sozinho, ou "Atlas, destino": o Atlas pergunta para onde. */
  | { type: 'ask_destination' }
  /** "Quero ir para o posto mais próximo" (RF-06). */
  | { type: 'go_category'; category: NearbyCategory }
  /** "Quero ir para a Faculdade Anhanguera" — um lugar pelo nome (RF-05). */
  | { type: 'go_place'; query: string }
  | { type: 'register_stop' }
  /** "Preciso abastecer ou descansar" — pede avaliação ao Random Forest. */
  | { type: 'need_rest_or_fuel' }
  | { type: 'register_tourist_spot' }
  /** "Adicionar parada" — com a categoria, quando dita ("parada num posto"). */
  | { type: 'add_stop'; category: NearbyCategory }
  | { type: 'emergency' }
  /** "Não estou me sentindo bem" — emergência com hospital primeiro (§11). */
  | { type: 'unwell' }
  | { type: 'end_trip' }
  /** "O primeiro", "número dois", "a terceira" — índice a partir de 0. */
  | { type: 'choose'; index: number }
  | { type: 'yes' }
  | { type: 'no' }
  | { type: 'unknown' };

/**
 * O que a conversa espera ouvir agora. Muda a leitura de frases curtas: "um"
 * é escolha quando há opções na tela, e "pode" é confirmação quando há uma
 * pergunta no ar.
 */
export type Expectation = 'command' | 'choice' | 'confirmation';

/** Sem acento, sem pontuação, minúsculo e com espaços simples. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A palavra de ativação no começo da frase: "ok atlas, registrar parada". */
const WAKE_WORD_AT_START = /^(?:(?:ok|ei|oi|e ai)\s+)?atlas\b\s*/;

/**
 * A palavra de ativação em qualquer lugar da frase.
 *
 * A escuta contínua ouve tudo o que se fala no carro, e a palavra raramente
 * cai no começo do trecho reconhecido: "...aí eu pedi pro Atlas achar um
 * posto" chega inteiro. Por isso aqui ela é procurada no meio, e o que vem
 * **depois** dela é o comando.
 */
const WAKE_WORD_ANYWHERE = /\batlas\b\s*/;

/**
 * Procura "Atlas" no que foi ouvido de passagem (RF-02, CA-02).
 *
 * `rest` é o que veio depois da palavra, e pode ser vazio: quem só chama pelo
 * nome diz o comando em seguida.
 */
export function findWakeWord(raw: string): { found: boolean; rest: string } {
  const text = normalize(raw);
  const match = WAKE_WORD_ANYWHERE.exec(text);

  return match
    ? { found: true, rest: text.slice(match.index + match[0].length).trim() }
    : { found: false, rest: '' };
}

/** Tira a palavra de ativação do começo: "ok atlas, registrar parada". */
export function stripWakeWord(text: string): { rest: string; hadWakeWord: boolean } {
  const match = WAKE_WORD_AT_START.exec(text);
  return match
    ? { rest: text.slice(match[0].length).trim(), hadWakeWord: true }
    : { rest: text, hadWakeWord: false };
}

const CATEGORY_WORDS: [NearbyCategory, RegExp][] = [
  ['hospital', /\b(hospital|pronto socorro|upa|posto de saude)\b/],
  ['posto', /\b(posto|gasolina|combustivel|etanol|alcool|diesel)\b/],
  ['restaurante', /\b(restaurante|comer|comida|almocar|almoco|jantar|lanche|lanchonete)\b/],
  ['hotel', /\b(hotel|pousada|motel|hospedagem|dormir)\b/],
  ['ponto_turistico', /\b(ponto turistico|turismo|turistico|passeio|mirante|museu|parque)\b/],
];

export function findCategory(text: string): NearbyCategory | null {
  return CATEGORY_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

const ORDINALS: [number, RegExp][] = [
  [0, /\b(primeir[oa]|um|uma|1|opcao um|numero um)\b/],
  [1, /\b(segund[oa]|dois|duas|2)\b/],
  [2, /\b(terceir[oa]|tres|3)\b/],
];

const YES = /^(sim|pode|pode sim|confirmo|confirma|confirmar|isso|claro|aceito|quero|bora|vamos|ok|beleza|certo)\b/;
const NO = /^(nao|agora nao|cancela|cancelar|deixa|deixa pra la|nao precisa|nao quero|negativo)\b/;

/**
 * Interpreta uma fala.
 *
 * A ordem das regras é a ordem de importância: mal-estar e emergência antes
 * de tudo, porque "não estou me sentindo bem, quero parar" é um pedido de
 * ajuda, não uma parada.
 */
export function parseCommand(raw: string, expecting: Expectation = 'command'): VoiceCommand {
  const { rest, hadWakeWord } = stripWakeWord(normalize(raw));
  const text = rest;

  if (!text) {
    return hadWakeWord ? { type: 'ask_destination' } : { type: 'unknown' };
  }

  if (
    /\b(nao (estou|to|tou) (me )?sentindo bem|(estou|to|tou) (me sentindo )?mal|passando mal|socorro|me ajuda)\b/.test(
      text,
    )
  ) {
    return { type: 'unwell' };
  }

  if (/\b(emergencia|samu|ambulancia|policia|acidente)\b/.test(text)) {
    return { type: 'emergency' };
  }

  // Frases curtas no meio de uma conversa.
  if (expecting === 'confirmation') {
    if (NO.test(text)) return { type: 'no' };
    if (YES.test(text)) return { type: 'yes' };
  }

  if (expecting === 'choice') {
    const ordinal = ORDINALS.find(([, pattern]) => pattern.test(text));
    if (ordinal) return { type: 'choose', index: ordinal[0] };
    if (NO.test(text)) return { type: 'no' };
  }

  if (/\b(encerr|termin|finaliz|acab)[a-z]* (a |minha )?viagem\b/.test(text)) {
    return { type: 'end_trip' };
  }

  if (/\bponto turistico\b/.test(text) && /\b(registr|marc|anot|salv)/.test(text)) {
    return { type: 'register_tourist_spot' };
  }

  if (/\b(adicion|inclu|acrescent)[a-z]* (uma )?parada\b/.test(text)) {
    return { type: 'add_stop', category: findCategory(text) ?? 'parada' };
  }

  if (/\b(registr|marc|anot|salv)[a-z]* (uma |a |essa )?parada\b/.test(text)) {
    return { type: 'register_stop' };
  }

  if (/\b(abastecer ou descansar|descansar ou abastecer)\b/.test(text)) {
    return { type: 'need_rest_or_fuel' };
  }

  // "Quero ir para…", "me leva ao…", "vamos para…", "destino…"
  const going = /\b(?:quero ir|ir|vamos|me leva|leva me|levar|destino|rota)\s*(?:para|pra|pro|ao|a|ate|no|na)?\s*(?:o |a |um |uma )?(.*)$/.exec(
    text,
  );

  const category = findCategory(text);
  if (category && (going || /\bmais proxim/.test(text) || /\bpreciso\b/.test(text))) {
    return { type: 'go_category', category };
  }

  if (/\bpreciso (abastecer|descansar|parar)\b/.test(text)) {
    return { type: 'need_rest_or_fuel' };
  }

  if (going) {
    const place = going[1].trim();
    return place ? { type: 'go_place', query: place } : { type: 'ask_destination' };
  }

  if (/^(destino|para onde)\b/.test(text)) {
    return { type: 'ask_destination' };
  }

  if (expecting === 'command' && category) {
    return { type: 'go_category', category };
  }

  return { type: 'unknown' };
}

/**
 * Qual das opções o usuário disse pelo nome (RF-14): "o Taquaral" escolhe o
 * "Posto Taquaral". Conta as palavras do nome que aparecem na fala; empate ou
 * nenhuma palavra em comum devolve `null`, e o Atlas pergunta de novo.
 */
export function matchOptionByName(raw: string, names: string[]): number | null {
  const spoken = new Set(normalize(raw).split(' ').filter((word) => word.length > 2));
  const ignored = new Set(['posto', 'restaurante', 'hotel', 'hospital', 'para', 'quero', 'esse']);

  const scores = names.map((name) => {
    const words = normalize(name)
      .split(' ')
      .filter((word) => word.length > 2 && !ignored.has(word));
    return words.filter((word) => spoken.has(word)).length;
  });

  const best = Math.max(0, ...scores);
  if (best === 0 || scores.filter((score) => score === best).length > 1) {
    return null;
  }

  return scores.indexOf(best);
}
