import { useCallback, useEffect, useRef, useState } from 'react';

import { sendScene } from '@/features/camera/services/scene-service';
import type { SceneCameraHandle } from '@/features/camera/components/scene-camera';
import type { SceneResult } from '@/features/camera/types/scene';
import type { Coordinate } from '@/features/map/types/coordinate';
import { IMAGE_CLASS_LABELS } from '@/features/trip-session/constants/journal-labels';

/**
 * De quanto em quanto tempo a câmera lê a cena.
 *
 * Igual ao ciclo das recomendações (5 min): a leitura chega ao diário pouco
 * antes da próxima avaliação, e é ela que mantém a variável "imagem" do
 * Random Forest viva. Mais frequente do que isso não mudaria a decisão e só
 * gastaria bateria.
 */
const READING_INTERVAL_MS = 5 * 60 * 1_000;

/** A primeira leitura sai logo depois da partida, não cinco minutos depois. */
const FIRST_READING_MS = 30 * 1_000;

export type SceneReadingsState = {
  /** Última classe lida, em português — legenda da miniatura da câmera. */
  caption: string | null;
  /** Resultado da última leitura, para quem quiser a confiança. */
  last: SceneResult | null;
  /** Fotografa agora e registra o ponto turístico (RF-11, RF-22). */
  registerTouristSpot: () => Promise<SceneResult>;
};

export type SceneReadingsParams = {
  tripId: string | null;
  camera: React.RefObject<SceneCameraHandle | null>;
  location: Coordinate | null;
};

/**
 * A câmera lendo a estrada durante a viagem (RF-16, RF-22).
 *
 * A leitura automática é silenciosa: a foto sobe, vira classe no diário e é
 * descartada. Uma falha não interrompe nada — sem rede, a viagem segue e a
 * variável "imagem" volta a ser "desconhecida", que é um valor que o modelo
 * aprendeu a tratar.
 */
export function useSceneReadings({
  tripId,
  camera,
  location,
}: SceneReadingsParams): SceneReadingsState {
  const [last, setLast] = useState<SceneResult | null>(null);

  // Lidos no disparo do temporizador, não na montagem dele: a posição muda a
  // cada leitura do GPS, e não pode reiniciar o ciclo da câmera.
  const latest = useRef({ tripId, location });

  useEffect(() => {
    latest.current = { tripId, location };
  }, [tripId, location]);

  const capture = useCallback(
    async (purpose: 'context' | 'tourist_spot') => {
      const { tripId: currentTrip, location: here } = latest.current;

      if (!currentTrip) {
        throw new Error('A viagem não está sendo registrada.');
      }

      const picture = await camera.current?.capture();

      if (!picture) {
        throw new Error('A câmera ainda não está pronta.');
      }

      const result = await sendScene({
        tripId: currentTrip,
        uri: picture.uri,
        purpose,
        location: here,
      });

      setLast(result);
      return result;
    },
    [camera],
  );

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const read = () => {
      capture('context').catch(() => {});
    };

    const firstId = setTimeout(read, FIRST_READING_MS);
    const intervalId = setInterval(read, READING_INTERVAL_MS);

    return () => {
      clearTimeout(firstId);
      clearInterval(intervalId);
    };
  }, [tripId, capture]);

  return {
    caption: last ? IMAGE_CLASS_LABELS[last.imageClass].split(' / ')[0] : null,
    last,
    registerTouristSpot: () => capture('tourist_spot'),
  };
}
