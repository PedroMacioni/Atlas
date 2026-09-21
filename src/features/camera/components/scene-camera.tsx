import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

export type SceneCameraHandle = {
  isReady: () => boolean;
  capture: () => Promise<CameraCapturedPicture | null>;
};

export type SceneCameraProps = {
  ref?: React.Ref<SceneCameraHandle>;
  /** Chamado após tirar a foto. */
  onCapture?: () => void;
};

const CAPTURE_QUALITY = 0.5;
const TARGET_PIXELS = 1280;

/** Botão que abre a câmera em tela cheia para registrar ponto turístico. */
export function SceneCamera({ ref, onCapture }: SceneCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [isCapturing, setIsCapturing] = useState(false);
  const insets = useSafeAreaInsets();
  const granted = permission?.granted ?? false;

  // Guarda a última foto para o handle consumir
  const lastPhoto = useRef<CameraCapturedPicture | null>(null);

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

  const takePicture = async () => {
    if (!isReady || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: CAPTURE_QUALITY,
        shutterSound: false,
      });
      if (photo) {
        lastPhoto.current = photo;
        setIsOpen(false);
        onCapture?.();
      }
    } finally {
      setIsCapturing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    isReady: () => isReady && granted,
    capture: async () => {
      // Retorna a última foto tirada pelo usuário
      const photo = lastPhoto.current;
      lastPhoto.current = null;
      return photo;
    },
  }));

  if (!granted) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir câmera para registrar ponto turístico"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="camera" size={28} color={colors.primaryDeep} />
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.fullscreen}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            pictureSize={pictureSize}
            onCameraReady={onCameraReady}
          />

          {/* Botão fechar no topo */}
          <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
            <FloatingIconButton
              size="lg"
              icon="close"
              accessibilityLabel="Fechar câmera"
              onPress={() => setIsOpen(false)}
            />
          </View>

          {/* Botão de captura na parte inferior */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tirar foto"
              onPress={takePicture}
              disabled={!isReady || isCapturing}
              style={({ pressed }) => [
                styles.shutter,
                pressed && styles.shutterPressed,
                (!isReady || isCapturing) && styles.shutterDisabled,
              ]}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

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
  button: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  pressed: {
    opacity: 0.75,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  shutterPressed: {
    opacity: 0.7,
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
});
