import { useCallback, useEffect, useRef, useState } from 'react';

import { sendScene } from '@/features/camera/services/scene-service';
import type { SceneCameraHandle } from '@/features/camera/components/scene-camera';
import type { SceneResult } from '@/features/camera/types/scene';
import type { Coordinate } from '@/features/map/types/coordinate';
import { IMAGE_CLASS_LABELS } from '@/features/trip-session/constants/journal-labels';

/**
 * De quanto em quanto tempo a câmera lê a cena (5 min, igual ao ciclo das
 * recomendações). Mais que isso só gastaria bateria.
 */
const READING_INTERVAL_MS = 5 * 60 * 1_000;

/** A primeira leitura sai 30 s depois da partida. */
const FIRST_READING_MS = 30 * 1_000;

export type SceneReadingsState = {
  /** Última classe lida, em português. */
  caption: string | null;
  /** Resultado da última leitura, para quem quiser a confiança. */
  last: SceneResult | null;
  /** Tira a foto e registra o ponto turístico (RF-11, RF-22). */
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
 * A leitura automática é silenciosa: a foto é enviada, vira classe no diário
 * e é descartada. Se falhar, a viagem segue e a variável "imagem" fica como
 * "desconhecida".
 *
 * Obs.: hoje a câmera só entrega a foto que o usuário tirou no botão da
 * câmera (`SceneCamera`). Sem foto nova, a leitura automática não acontece.
 */
export function useSceneReadings({
  tripId,
  camera,
  location,
}: SceneReadingsParams): SceneReadingsState {
  const [last, setLast] = useState<SceneResult | null>(null);

  // Lidos na hora da foto (e não ao criar o timer), para a posição mudar sem reiniciar o ciclo.
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
