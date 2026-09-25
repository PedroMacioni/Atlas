import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/icon-badge';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import {
  EMERGENCY_LABELS,
  EMERGENCY_NUMBERS,
  runEmergencyAction,
  type EmergencyAction,
} from '@/features/emergency/utils/emergency-actions';
import type { Coordinate } from '@/features/map/types/coordinate';
import { NearbyOptions } from '@/features/nearby/components/nearby-options';
import { useNearbySearch } from '@/features/nearby/hooks/use-nearby-search';
import { isNearbyAvailable } from '@/features/nearby/services/nearby-service';
import type { NearbyPlace } from '@/features/nearby/types/nearby';
import { requestDetour } from '@/features/trip/state/detour-request';
import { recordEvent } from '@/features/trip-session/services/trip-session-service';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

const OPTIONS: {
  action: EmergencyAction;
  icon: IconName;
  title: string;
  subtitle: string;
}[] = [
  {
    action: 'samu',
    icon: 'ambulance',
    title: `SAMU ${EMERGENCY_NUMBERS.samu}`,
    subtitle: 'Urgência médica — liga agora',
  },
  {
    action: 'policia',
    icon: 'shield-account',
    title: `Polícia ${EMERGENCY_NUMBERS.policia}`,
    subtitle: 'Acidente, roubo ou ameaça — liga agora',
  },
];

/**
 * Tela de emergência (escopo §11, RF-23).
 *
 * Abre por cima de qualquer tela. Botões grandes para SAMU e Polícia, sem nada
 * no caminho. Durante uma viagem, cada ação é gravada no diário (a ligação
 * sai primeiro; o registro vai em paralelo).
 *
 * Hospital (RF-24): a tela já abre buscando os 3 hospitais mais próximos.
 * Durante uma viagem, o escolhido vira uma parada na rota; fora dela, vira o
 * destino de uma viagem nova. O botão do app de mapas fica como reserva.
 */
export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string; latitude?: string; longitude?: string }>();
  const [failed, setFailed] = useState<EmergencyAction | null>(null);

  const near = parseCoordinate(params.latitude, params.longitude);
  const canSearch = near !== null && isNearbyAvailable();

  const hospitals = useNearbySearch(canSearch && near ? { category: 'hospital', around: near } : null);

  const goToHospital = (hospital: NearbyPlace) => {
    if (params.tripId) {
      recordEvent(params.tripId, {
        kind: 'emergency',
        command: `Emergência: rumo ao ${hospital.name}`,
        location: near,
      }).catch(() => {});

      requestDetour({
        name: hospital.name,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        category: 'hospital',
        reason: 'Emergência',
      });
      router.back();
      return;
    }

    router.replace({
      pathname: '/trip',
      params: {
        name: hospital.name,
        latitude: String(hospital.latitude),
        longitude: String(hospital.longitude),
      },
    });
  };

  const trigger = (action: EmergencyAction) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }

    runEmergencyAction(action, near).then((opened) => setFailed(opened ? null : action));

    if (params.tripId) {
      recordEvent(params.tripId, {
        kind: 'emergency',
        command: EMERGENCY_LABELS[action],
        location: near,
      }).catch(() => {
        // O diário é secundário aqui: a ligação já saiu.
      });
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      showsVerticalScrollIndicator={false}>
      <Text variant="bodySoft" color="textSecondary">
        O Atlas não substitui os serviços oficiais de emergência — apenas encurta o caminho até
        eles.
      </Text>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.action}
          accessibilityRole="button"
          accessibilityLabel={option.title}
          accessibilityHint={option.subtitle}
          onPress={() => trigger(option.action)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name={option.icon} size={28} color={colors.danger} />
          </View>
          <View style={styles.texts}>
            <Text variant="heading">{option.title}</Text>
            <Text variant="bodySoft" color="textSecondary">
              {option.subtitle}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </Pressable>
      ))}

      <SectionHeader title="Hospitais mais próximos" hint={canSearch ? '3 opções' : undefined} />

      {canSearch ? (
        <NearbyOptions
          result={hospitals.result}
          isLoading={hospitals.isLoading}
          error={hospitals.error}
          onRetry={hospitals.retry}
          onSelect={goToHospital}
          actionLabel="Ir para o hospital"
        />
      ) : (
        <Text variant="bodySoft" color="textSecondary">
          {near
            ? 'A lista de hospitais vem da API do Atlas, que não está configurada.'
            : 'Sem localização, não há como achar o hospital mais próximo.'}
        </Text>
      )}

      <SecondaryButton
        label="Abrir hospitais no mapa do aparelho"
        onPress={() => trigger('hospital')}
      />

      {failed ? (
        <StatusMessage
          tone="error"
          message={
            failed === 'hospital'
              ? 'Não foi possível abrir o mapa neste aparelho.'
              : `Não foi possível abrir o discador. Ligue para ${EMERGENCY_NUMBERS[failed]}.`
          }
        />
      ) : null}
    </ScrollView>
  );
}

function parseCoordinate(latitude?: string, longitude?: string): Coordinate | null {
  const lat = Number(latitude);
  const lon = Number(longitude);

  return latitude && longitude && Number.isFinite(lat) && Number.isFinite(lon)
    ? { latitude: lat, longitude: lon }
    : null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
