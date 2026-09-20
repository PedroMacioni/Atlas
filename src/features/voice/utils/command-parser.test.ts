import { describe, expect, it } from 'vitest';

import { findWakeWord, parseCommand, stripWakeWord } from '@/features/voice/utils/command-parser';

/**
 * Os comandos do escopo (§3.1), como eles chegam de verdade.
 *
 * O reconhecedor de fala devolve texto corrido, sem pontuação e às vezes sem
 * acento — os casos aqui são escritos assim de propósito.
 */
describe('parseCommand', () => {
  it('entende as categorias ditas de formas diferentes', () => {
    expect(parseCommand('Atlas, quero ir para o posto mais próximo')).toEqual({
      type: 'go_category',
      category: 'posto',
    });
    expect(parseCommand('estou com fome')).toEqual({
      type: 'go_category',
      category: 'restaurante',
    });
    expect(parseCommand('preciso de um hospital')).toEqual({
      type: 'go_category',
      category: 'hospital',
    });
  });

  it('separa os comandos da viagem', () => {
    expect(parseCommand('registrar parada').type).toBe('register_stop');
    expect(parseCommand('atlas registrar ponto turistico').type).toBe('register_tourist_spot');
    expect(parseCommand('preciso abastecer ou descansar').type).toBe('need_rest_or_fuel');
    expect(parseCommand('encerrar viagem').type).toBe('end_trip');
  });

  it('cansaço pede uma avaliação ao Random Forest', () => {
    // Ninguém dirigindo fala "preciso abastecer ou descansar".
    expect(parseCommand('atlas estou cansado').type).toBe('need_rest_or_fuel');
    expect(parseCommand('to muito cansado').type).toBe('need_rest_or_fuel');
    expect(parseCommand('estou com sono').type).toBe('need_rest_or_fuel');
    expect(parseCommand('nao aguento mais dirigir').type).toBe('need_rest_or_fuel');
    expect(parseCommand('preciso descansar').type).toBe('need_rest_or_fuel');
  });

  it('cansaço não é mal-estar: um pede recomendação, o outro abre a emergência', () => {
    expect(parseCommand('estou cansado').type).toBe('need_rest_or_fuel');
    expect(parseCommand('nao estou me sentindo bem').type).toBe('unwell');
  });

  it('trata mal-estar como emergência, e não como pedido de hospital', () => {
    expect(parseCommand('nao estou me sentindo bem').type).toBe('unwell');
    expect(parseCommand('socorro').type).toBe('unwell');
    expect(parseCommand('emergencia').type).toBe('emergency');
  });

  it('só chamar pelo nome é um pedido de destino', () => {
    expect(parseCommand('Atlas')).toEqual({ type: 'ask_destination' });
    expect(parseCommand('ok atlas')).toEqual({ type: 'ask_destination' });
  });

  it('o que sobra é o nome de um lugar', () => {
    expect(parseCommand('quero ir para a faculdade anhanguera')).toEqual({
      type: 'go_place',
      query: 'faculdade anhanguera',
    });
  });

  it('não inventa comando a partir de conversa solta', () => {
    expect(parseCommand('nossa que transito hoje').type).toBe('unknown');
    expect(parseCommand('').type).toBe('unknown');
  });

  describe('com opções na tela, frases curtas viram escolha', () => {
    it('aceita número e ordinal', () => {
      expect(parseCommand('o primeiro', 'choice')).toEqual({ type: 'choose', index: 0 });
      expect(parseCommand('numero dois', 'choice')).toEqual({ type: 'choose', index: 1 });
      expect(parseCommand('a terceira', 'choice')).toEqual({ type: 'choose', index: 2 });
    });

    it('mas a mesma frase fora do contexto não é escolha', () => {
      expect(parseCommand('um').type).not.toBe('choose');
    });
  });

  it('com uma pergunta no ar, entende sim e não', () => {
    expect(parseCommand('pode ser', 'confirmation').type).toBe('yes');
    expect(parseCommand('agora nao', 'confirmation').type).toBe('no');
  });
});

describe('palavra de ativação', () => {
  it('tira "Atlas" do começo da frase', () => {
    expect(stripWakeWord('atlas registrar parada')).toEqual({
      rest: 'registrar parada',
      hadWakeWord: true,
    });
    expect(stripWakeWord('ok atlas')).toEqual({ rest: '', hadWakeWord: true });
    expect(stripWakeWord('registrar parada')).toEqual({
      rest: 'registrar parada',
      hadWakeWord: false,
    });
  });

  it('acha "Atlas" no meio do que a escuta contínua ouviu', () => {
    // É assim que chega: um pedaço de conversa com o nome no meio.
    expect(findWakeWord('entao eu falei atlas quero um posto')).toEqual({
      found: true,
      rest: 'quero um posto',
    });
    expect(findWakeWord('Atlas!')).toEqual({ found: true, rest: '' });
  });

  it('não confunde "Atlas" com outra palavra que o contenha', () => {
    expect(findWakeWord('o atlasnauta chegou').found).toBe(false);
    expect(findWakeWord('nada aqui').found).toBe(false);
  });
});
