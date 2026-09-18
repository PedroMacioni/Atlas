import { useEffect, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Mecânica de um painel de duas posições — fechado e aberto — arrastável.
 *
 * A animação é uma **translação**, não uma mudança de altura: o painel é
 * montado inteiro e desce o tamanho exato da área que deve ficar escondida,
 * medida no layout por quem usa o hook. Animar `translateY` roda na thread de
 * UI e acompanha o dedo sem depender do JavaScript; animar altura reflui o
 * conteúdo a cada quadro.
 *
 * Fica num hook, e não dentro do componente, por dois motivos: mantém o painel
 * como apresentação pura, e concentra num lugar só a exceção de lint explicada
 * abaixo.
 */

/**
 * Fração da área escondida que precisa ser arrastada para o painel abrir.
 *
 * Um terço, e não metade: abrir é a ação que o usuário pediu ao começar a
 * arrastar, e exigir o caminho inteiro faz o gesto parecer travado. Fechar pede
 * o mesmo esforço na direção contrária.
 */
const OPEN_THRESHOLD = 1 / 3;

/**
 * Velocidade a partir da qual o movimento decide sozinho, em pt/s.
 *
 * Um arrasto rápido e curto é uma intenção clara — puxar o painel com o polegar
 * sem percorrer a distância toda. Sem isso, um gesto ligeiro seria ignorado e o
 * painel voltaria, o que se sente como se o aplicativo não tivesse entendido.
 */
const FLICK_VELOCITY = 500;

/** Mola curta e sem balanço: um painel não deve quicar. */
const SPRING = { damping: 22, stiffness: 220, mass: 0.7 } as const;

export function useDraggableSheet() {
  /**
   * Altura da área escondida quando o painel está fechado.
   *
   * Medida em vez de fixada: os botões crescem com o corpo de texto do
   * sistema, e um valor cravado deixaria um pedaço de botão à mostra — ou
   * cortaria parte dele — em quem usa fonte grande.
   */
  const [hiddenHeight, setHiddenHeight] = useState(0);

  const offset = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const isOpen = useSharedValue(false);

  /*
    `react-hooks/immutability` trata os valores compartilhados do Reanimated
    como imutáveis, porque para o React Compiler qualquer escrita durante a
    renderização é suspeita. Aqui as escritas acontecem dentro de worklets de
    gesto e de um efeito — nunca no corpo do componente —, que é exatamente o
    uso que a biblioteca prescreve. A regra é desligada neste arquivo e em
    nenhum outro, o que mantém a exceção visível e contida.
  */
  /* eslint-disable react-hooks/immutability */

  const settle = (open: boolean) => {
    'worklet';
    isOpen.value = open;
    offset.value = withSpring(open ? 0 : hiddenHeight, SPRING);
  };

  /**
   * Fecha o painel assim que a altura escondida é conhecida.
   *
   * O deslocamento nasce em zero porque não há o que medir antes do primeiro
   * layout, então existe um quadro em que o painel aparece aberto. Fechá-lo
   * aqui é um salto, e não uma mola, de propósito: uma animação de fechamento
   * na abertura da tela pareceria um painel se recolhendo sozinho.
   *
   * Também reage a mudanças posteriores — rotação, ou corpo de texto do
   * sistema alterado com a tela aberta.
   */
  useEffect(() => {
    if (!isOpen.value) {
      offset.value = hiddenHeight;
    }
  }, [hiddenHeight, isOpen, offset]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startOffset.value = offset.value;
    })
    .onUpdate((event) => {
      // Preso entre aberto (0) e fechado: arrastar além não leva a lugar
      // nenhum, e a resistência comunica o limite melhor que um salto.
      const next = startOffset.value + event.translationY;
      offset.value = Math.min(hiddenHeight, Math.max(0, next));
    })
    .onEnd((event) => {
      const flickedUp = event.velocityY < -FLICK_VELOCITY;
      const flickedDown = event.velocityY > FLICK_VELOCITY;

      if (flickedUp || flickedDown) {
        settle(flickedUp);
        return;
      }

      // Sem velocidade decisiva, quem manda é a posição.
      settle(offset.value < hiddenHeight * (1 - OPEN_THRESHOLD));
    });

  // Um toque faz o mesmo que o arrasto, para quem não quer arrastar.
  const tap = Gesture.Tap().onEnd(() => {
    settle(!isOpen.value);
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  /* eslint-enable react-hooks/immutability */

  return {
    /** Gesto a ser aplicado na área de arraste — nunca no painel inteiro. */
    gesture: Gesture.Exclusive(pan, tap),
    /** Estilo animado do painel. */
    sheetStyle,
    /** Mede a área que deve ficar escondida quando fechado. */
    onHiddenAreaLayout: setHiddenHeight,
    /** Fecha o painel — usado pela ação "Continuar". */
    close: () => settle(false),
    /** `true` enquanto o painel está aberto. Acompanha o gesto. */
    isOpen,
  };
}

/**
 * Inferido do hook em vez de declarado à mão: os tipos de `Gesture` e de
 * `useAnimatedStyle` mudam entre versões do Reanimated e do gesture-handler, e
 * repeti-los aqui só criaria uma segunda verdade para manter.
 */
export type DraggableSheet = ReturnType<typeof useDraggableSheet>;
