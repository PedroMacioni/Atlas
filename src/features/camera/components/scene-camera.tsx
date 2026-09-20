import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type SceneCameraHandle = {
  /** `true` quando a câmera já pode fotografar. */
  isReady: () => boolean;
  /** Tira a foto e devolve o arquivo local, ou `null` se ainda não dá. */
  capture: () => Promise<CameraCapturedPicture | null>;
};

export type SceneCameraProps = {
  ref?: React.Ref<SceneCameraHandle>;
  /** Toque na miniatura — "Registrar ponto turístico". */
  onPress?: () => void;
  /** Classe da última leitura, mostrada sob a imagem. */
  caption?: string | null;
};

/**
 * A câmera que o Atlas usa para ver a estrada (RF-16, RF-22).
 *
 * É uma **miniatura visível**, e não uma câmera escondida, por dois motivos:
 * o `expo-camera` só fotografa com a pré-visualização montada e pronta
 * (`onCameraReady`), e uma câmera que grava sem aparecer seria desonesta com
 * quem está no carro. Do tamanho de um crachá, no canto, ela diz o que a IA
 * está vendo — e tocá-la registra o ponto turístico na hora.
 *
 * A foto sai pequena de propósito: o classificador enxerga 224 px, e subir
 * 12 megapixels pela rede do celular só atrasaria a leitura.
 */
const CAPTURE_QUALITY = 0.5;

/** Alvo do lado maior da foto. A câmera escolhe o tamanho mais perto disso. */
const TARGET_PIXELS = 1280;

export function SceneCamera({ ref, onPress, caption }: SceneCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isReady, setIsReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const granted = permission?.granted ?? false;

  // Uma vez, na montagem: a permissão é pedida quando a câmera vai ser usada,
  // e não na abertura do aplicativo (escopo §13.2).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  const onCameraReady = useCallback(async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      setPictureSize(chooseSize(sizes ?? []));
    } catch {
      // Sem lista de tamanhos, a câmera usa o padrão dela.
    }
    setIsReady(true);
  }, []);

  useImperativeHandle(ref, () => ({
    isReady: () => isReady && granted,
    capture: async () => {
      if (!isReady || !granted) {
        return null;
      }
      return (
        (await cameraRef.current?.takePictureAsync({
          quality: CAPTURE_QUALITY,
          // Sem som: a leitura automática dispara sozinha durante a viagem.
          shutterSound: false,
        })) ?? null
      );
    },
  }));

  if (!granted) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Registrar ponto turístico com a câmera"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <CameraView
        ref={cameraRef}
        style={styles.preview}
        facing="back"
        pictureSize={pictureSize}
        onCameraReady={onCameraReady}
      />
      <View style={styles.caption}>
        <Text variant="label" color="textOnPrimary" numberOfLines={1} align="center">
          {caption ?? (isReady ? 'IA vendo' : 'Ligando…')}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * O tamanho de foto mais perto de 1280 px no lado maior.
 *
 * O Android devolve `"1920x1080"`; o iOS devolve apelidos como `"Photo"`, que
 * não dizem quantos pixels são. Sem nenhum tamanho reconhecível, `undefined`
 * deixa a escolha com a câmera.
 */
function chooseSize(sizes: string[]): string | undefined {
  const measured = sizes
    .map((size) => ({ size, pixels: Math.max(...size.split('x').map(Number)) }))
    .filter(({ pixels }) => Number.isFinite(pixels));

  if (measured.length === 0) {
    return undefined;
  }

  return measured.reduce((best, current) =>
    Math.abs(current.pixels - TARGET_PIXELS) < Math.abs(best.pixels - TARGET_PIXELS)
      ? current
      : best,
  ).size;
}

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.text,
    ...shadows.raised,
  },
  pressed: {
    opacity: 0.7,
  },
  preview: {
    flex: 1,
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(15, 31, 61, 0.65)',
  },
});
