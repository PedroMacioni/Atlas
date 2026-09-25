import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingIconButton } from '@/components/ui/floating-icon-button';
import { SceneCamera, type SceneCameraHandle } from '@/features/camera/components/scene-camera';
import { useSceneReadings } from '@/features/camera/hooks/use-scene-readings';
import { describeSceneError } from '@/features/camera/services/scene-service';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { StatusMessage } from '@/components/ui/status-message';
import { Text } from '@/components/ui/text';
import { DEV_MODE } from '@/config/flags';
import {
  DEMO_DRIVE_DESTINATION,
  DEMO_DRIVE_ORIGIN,
  DEMO_SPEED_METERS_PER_SECOND,
  PRESENTATION_STOP_NAME,
} from '@/features/demo/constants/demo-drive';
import { useDemoDrive } from '@/features/demo/hooks/use-demo-drive';
import { pointAlongRoute } from '@/features/demo/utils/route-point';
import {
  getDemoScenario,
  resetDemoScenario,
  setDemoScenario,
} from '@/features/demo/state/demo-scenario';
import { useLocationTracking } from '@/features/location/hooks/use-location-tracking';
import { AtlasMap, type AtlasMapHandle } from '@/features/map/components/atlas-map';
import { ManeuverBanner } from '@/features/trip/components/maneuver-banner';
import { SpeedBadge } from '@/features/trip/components/speed-badge';
import { TripBottomSheet } from '@/features/trip/components/trip-bottom-sheet';
import { TripStatusCard } from '@/features/trip/components/trip-status-card';
import { useDetour } from '@/features/trip/hooks/use-detour';
import { subscribeTripActions } from '@/features/trip/state/trip-action-request';
import { DEMO_ORIGIN } from '@/features/trip/constants/demo-route';
import { useTripDestination } from '@/features/trip/hooks/use-trip-destination';
import { useTripOrigin } from '@/features/trip/hooks/use-trip-origin';
import { useTripProgress } from '@/features/trip/hooks/use-trip-progress';
import { useTripRoute } from '@/features/trip/hooks/use-trip-route';
import { NearbyOptions } from '@/features/nearby/components/nearby-options';
import { useNearbySearch } from '@/features/nearby/hooks/use-nearby-search';
import { DECISION_CATEGORY } from '@/features/nearby/services/nearby-service';
import type { NearbyPlace, NearbyResponse } from '@/features/nearby/types/nearby';
import { RecommendationCard } from '@/features/recommendation/components/recommendation-card';
import { useRecommendations } from '@/features/recommendation/hooks/use-recommendations';
import {
  useTripSession,
  type FinishOverride,
} from '@/features/trip-session/hooks/use-trip-session';
import { IMAGE_CLASS_LABELS } from '@/features/trip-session/constants/journal-labels';
import {
  describeTripError,
  recordEvent,
} from '@/features/trip-session/services/trip-session-service';
import type { EndReason } from '@/features/trip-session/types/trip';
import type { RouteResult } from '@/features/routing/types/route-result';
import { findNextManeuver } from '@/features/trip/utils/next-maneuver';
import { buildRouteGeometry } from '@/features/trip/utils/trip-progress';
import { VoiceIndicator } from '@/features/voice/components/voice-indicator';
import {
  describeEmotion,
  sendVoiceCommand,
} from '@/features/voice/services/voice-command-service';
import { useTripVoice } from '@/features/voice/hooks/use-trip-voice';
import { useWakeWord } from '@/features/voice/hooks/use-wake-word';
import { chooseOptionByVoice, confirmByVoice } from '@/features/voice/utils/voice-dialogs';
import { PresentationOverlay } from '@/features/presentation';
import { setPresentationState, usePresentationState } from '@/features/presentation/state/presentation-state';
import { WakeStatusCard } from '@/features/voice/components/wake-status-card';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

const EMPTY_ROUTE: never[] = [];

/** Espaço que a câmera do mapa reserva nas bordas (a faixa de instrução e o painel cobrem o mapa). */
const MAP_EDGE_PADDING = { top: 150, bottom: 210, left: 56, right: 56 };

/** Quanto tempo o aviso curto (ex.: "Parada registrada") fica na tela. */
const NOTICE_MS = 2_500;

/**
 * Tela da viagem em andamento.
 *
 * O mapa ocupa a tela inteira e o resto flutua por cima: a instrução da
 * próxima manobra no topo e o painel com a hora de chegada embaixo.
 *
 * A tela só junta as peças: localização, rota, progresso, manobras, voz,
 * câmera e recomendações ficam cada uma na sua pasta em `features/`.
 */
export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AtlasMapHandle>(null);
  const cameraRef = useRef<SceneCameraHandle>(null);

  /*
    Modo demonstração (`atlas://trip?demo=1`): a rota é real, mas a posição não
    vem do GPS. Um ponto "anda" sobre a rota a partir da metade dela, para
    mostrar a viagem em andamento sem precisar dirigir.
  */
  const { demo: demoParam, presentation: presentationParam, skipIntro: skipIntroParam } = useLocalSearchParams<{
    demo?: string;
    presentation?: string;
    skipIntro?: string;
  }>();
  const isDemo = demoParam === '1';
  // Sem `EXPO_PUBLIC_DEV_MODE`, o parâmetro é ignorado (mesmo vindo por link).
  const isPresentation = DEV_MODE && presentationParam === '1';
  const skipIntro = skipIntroParam === '1';
  const presentationState = usePresentationState();

  // O modo apresentação também usa a viagem de demonstração.
  const effectiveDemo = isDemo || isPresentation;

  const chosenDestination = useTripDestination();
  const destination = effectiveDemo ? DEMO_DRIVE_DESTINATION : chosenDestination;

  const tracking = useLocationTracking(!effectiveDemo);
  const gpsOrigin = useTripOrigin(tracking.position?.coordinate ?? null, tracking.isStarting);
  const origin = effectiveDemo ? DEMO_DRIVE_ORIGIN : gpsOrigin;

  /*
    A rota chega à demonstração por um estado (com um render de atraso), porque
    a posição simulada depende da rota e a rota (com desvio) depende da posição.
  */
  const [demoRoute, setDemoRoute] = useState<RouteResult | null>(null);
  const demoDrive = useDemoDrive(effectiveDemo, demoRoute);

  const position = effectiveDemo ? demoDrive.position : tracking.position;

  const session = useTripSession({ origin, destination, position });

  const [notice, setNotice] = useState<string | null>(null);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Mostra um aviso curto sob a faixa de instrução. */
  const flash = (message: string) => {
    setNotice(message);
    // Um aviso novo reinicia o tempo; sem isso, o timer do aviso anterior
    // apagaria o novo antes da hora.
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  // Ao sair da tela, cancela o timer do aviso.
  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  /*
    Parada no caminho (de uma recomendação aceita ou de um hospital da
    emergência). Ao chegar, vira parada no diário com o nome do lugar.
  */
  const detour = useDetour(position?.coordinate ?? null, (reached) => {
    session
      .registerStop({ name: reached.name, category: reached.category, reason: reached.reason })
      .then(() => flash(`Parada registrada: ${reached.name}.`))
      .catch(() => flash(`Você chegou a ${reached.name}.`));
  });

  const trip = useTripRoute(detour.routeOrigin ?? origin, destination, detour.waypoints);
  const progressRoute = effectiveDemo ? (trip.route ?? demoRoute) : trip.route;
  const progress = useTripProgress(progressRoute, position?.coordinate ?? null);

  /*
    Atualiza a rota da demonstração durante a renderização. Só usa a rota pronta:
    enquanto um desvio é calculado a rota fica nula por alguns segundos, e o
    carro sumiria do mapa.
  */
  if (effectiveDemo && trip.route && demoRoute !== trip.route) {
    setDemoRoute(trip.route);
  }

  // Cada demonstração começa do cenário padrão.
  useEffect(() => {
    if (effectiveDemo) {
      resetDemoScenario();
    }
  }, [effectiveDemo]);

  /*
    A distância que o modelo vê começa igual à que o carro simulado já andou.
    Depois disso quem manda é a tela de condições.
  */
  const demoDistanceSynced = useRef(false);

  useEffect(() => {
    if (!effectiveDemo || demoDistanceSynced.current || demoDrive.traveledMeters <= 0) {
      return;
    }

    demoDistanceSynced.current = true;
    setDemoScenario({
      ...getDemoScenario(),
      distanceKm: Math.round(demoDrive.traveledMeters / 1_000),
    });
  }, [effectiveDemo, demoDrive.traveledMeters]);

  // Os 3 lugares para uma recomendação aceita (RF-19).
  const stopOptions = useNearbySearch();
  const [presentationStopOptions, setPresentationStopOptions] = useState(false);
  const [stopReason, setStopReason] = useState('');

  const recommendations = useRecommendations({
    tripId: session.tripId,
    // Na demonstração a distância vem do carro simulado (o GPS não andou).
    traveledMeters: effectiveDemo ? demoDrive.traveledMeters : session.traveledMeters,
    location: position?.coordinate ?? null,
  });

  /**
   * Pede uma avaliação ao Random Forest. Na demonstração envia também as
   * condições da tela de cenário (lidas na hora do toque).
   */
  const askRecommendation = () => recommendations.ask(effectiveDemo ? getDemoScenario() : undefined);

  const scene = useSceneReadings({
    tripId: session.tripId,
    camera: cameraRef,
    location: position?.coordinate ?? null,
  });

  const [isFollowing, setIsFollowing] = useState(true);
  const [isEnding, setIsEnding] = useState(false);


  /**
   * Próxima manobra. Sem posição ainda, mostra a primeira manobra do trajeto,
   * para a faixa aparecer assim que a rota chega.
   */
  const nextManeuver = useMemo(() => {
    if (!trip.route) {
      return null;
    }

    return findNextManeuver(trip.route.steps, progress?.traveledMeters ?? 0);
  }, [trip.route, progress]);

  const hasPosition = position !== null;
  const hasArrived = progress?.hasArrived ?? false;

  /*
    Onde o mapa desenha "você" (RF-07).

    Na rota, usa a posição "grudada" no trajeto (a seta fica em cima da rua, e
    não na calçada) e a direção da rua. Fora da rota, usa a leitura do GPS.
  */
  const onRoute = progress !== null && !progress.isOffRoute;
  const mapLocation = onRoute ? progress.snappedPoint : (position?.coordinate ?? null);
  const mapHeading = (onRoute ? progress.courseDegrees : null) ?? position?.heading ?? null;

  // Sem posição, mostra os totais da rota.
  const remainingMeters = progress?.remainingMeters ?? progressRoute?.distanceMeters ?? 0;
  const remainingSeconds = effectiveDemo
    ? Math.round(remainingMeters / DEMO_SPEED_METERS_PER_SECOND)
    : progress?.remainingSeconds ?? trip.route?.durationSeconds ?? 0;

  /**
   * Encerra a viagem e abre o resumo. Sem API, só volta. Se salvar falhar,
   * oferece tentar de novo ou sair sem salvar.
   */
  const endTrip = async (reason: EndReason, override?: FinishOverride) => {
    if (isEnding) {
      return;
    }

    setIsEnding(true);

    try {
      const tripId = await session.finish(reason, override);

      if (tripId) {
        router.replace({
          pathname: '/history/[id]',
          params: { id: tripId, ...(isPresentation ? { presentation: '1' } : {}) },
        });
      } else {
        router.back();
      }
    } catch (cause) {
      setIsEnding(false);
      Alert.alert('Não foi possível salvar a viagem', describeTripError(cause), [
        { text: 'Sair sem salvar', style: 'destructive', onPress: () => router.back() },
        { text: 'Tentar de novo', onPress: () => endTrip(reason, override) },
      ]);
    }
  };

  /**
   * "Cheguei" da demonstração: conclui como se o trajeto inteiro tivesse sido
   * feito, com o caminho completo, a distância somada e uma hora de chegada
   * coerente com o tempo da rota.
   */
  const concludeDemoTrip = async () => {
    const complete = demoDrive.completeTrip();

    if (complete.path.length < 2) {
      flash('A rota ainda não chegou.');
      return;
    }

    const endedAt = session.startedAt
      ? new Date(Date.parse(session.startedAt) + complete.durationSeconds * 1_000).toISOString()
      : undefined;

    await endTrip('arrival', {
      distanceMeters: complete.distanceMeters,
      path: complete.path,
      endedAt,
    });
  };

  /** "Parar" pede confirmação: encerrar é definitivo e gera o resumo (RF-25). */
  const confirmEnd = () => {
    Alert.alert('Encerrar viagem?', 'O Atlas salva o trajeto e mostra o resumo.', [
      { text: 'Continuar viagem', style: 'cancel' },
      { text: 'Encerrar', style: 'destructive', onPress: () => endTrip('button') },
    ]);
  };

  /**
   * Chegada ao destino: o Atlas pergunta uma vez se deve encerrar (RF-25). Não
   * encerra sozinho porque o GPS acusa a chegada a 40 m e ainda pode faltar
   * achar a vaga.
   */
  const arrivalAsked = useRef(false);

  useEffect(() => {
    if (!hasArrived || arrivalAsked.current) {
      return;
    }

    arrivalAsked.current = true;

    Alert.alert('Você chegou ao destino', 'Encerrar a viagem e ver o resumo?', [
      { text: 'Ainda não', style: 'cancel' },
      { text: 'Encerrar', onPress: () => endTrip('arrival') },
    ]);
    // Só a transição para "chegou" importa; `endTrip` é lido no toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasArrived]);

  const openEmergency = () => {
    const here = position?.coordinate;

    router.push({
      pathname: '/emergency',
      params: {
        ...(session.tripId ? { tripId: session.tripId } : null),
        ...(here ? { latitude: String(here.latitude), longitude: String(here.longitude) } : null),
      },
    });
  };

  /**
   * Resposta à recomendação (§4.7, CA-10):
   * - DESCANSAR, ABASTECER, ALIMENTAR-SE e FAZER UMA PARADA buscam 3 lugares;
   *   a rota só muda quando o usuário escolhe um deles;
   * - REGISTRAR PONTO TURÍSTICO grava o local no diário na hora;
   * - CONTINUAR não muda nada.
   */
  const answerRecommendation = (accepted: boolean) => {
    const current = recommendations.current;
    const decision = current?.decision;
    const here = position?.coordinate ?? null;

    recommendations.answer(accepted).catch(() => {});

    const category = decision ? DECISION_CATEGORY[decision] : undefined;
    if (accepted && category && here) {
      setStopReason(`Recomendação do Atlas: ${current?.label}`);
      if (isPresentation) {
        setPresentationStopOptions(true);
      } else {
        stopOptions.search(category, here);
      }
    } else if (accepted && category) {
      flash('Sem localização para buscar lugares por perto.');
    }

    if (accepted && decision === 'registrar_ponto_turistico') {
      registerTouristSpot().catch(() => {});
    }
  };

  /**
   * "Registrar ponto turístico" (RF-11, RF-22). Com foto, ela é classificada e
   * aparece no resumo. Sem câmera ou com a IA de imagem fora do ar, grava só o
   * local.
   */
  const registerTouristSpot = async () => {
    if (!session.tripId) {
      throw new Error('A viagem não está sendo registrada.');
    }

    if (cameraRef.current?.isReady()) {
      try {
        const result = await scene.registerTouristSpot();
        const label = IMAGE_CLASS_LABELS[result.imageClass];
        flash(`Ponto turístico registrado — a IA viu ${label.toLowerCase()}.`);
        return;
      } catch (cause) {
        flash(`${describeSceneError(cause)} Registrando só o local.`);
      }
    }

    await recordEvent(session.tripId, {
      kind: 'tourist_spot',
      command: 'Ponto turístico registrado',
      location: position?.coordinate ?? null,
    });
    flash('Ponto turístico registrado no diário.');
  };

  /** Chamado depois que o usuário tira a foto na câmera. */
  const onCameraCapture = () => {
    registerTouristSpot().catch((cause: unknown) => flash(describeSceneError(cause)));
  };

  const registerStop = () => {
    session
      .registerStop()
      .then(() => flash('Parada registrada no diário.'))
      .catch((cause: unknown) =>
        flash(cause instanceof Error ? cause.message : describeTripError(cause)),
      );
  };

  /** O lugar escolhido vira uma parada no caminho; o destino continua o mesmo. */
  const chooseStop = (place: NearbyPlace) => {
    detour.start({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      category: stopOptions.category ?? 'parada',
      reason: stopReason,
    });
    stopOptions.clear();
  };

  /*
    Voz (RF-11, RF-12, RF-20). Quando uma busca de parada vem de um pedido
    falado, as opções são lidas e escolhidas por voz (RF-13, RF-14). O ref
    marca isso.
  */
  const readOptionsByVoice = useRef(false);

  const describeTripProgress = () => {
    if (!trip.route) return 'Ainda estou calculando a rota.';
    const distance = remainingMeters >= 1_000
      ? `${(remainingMeters / 1_000).toFixed(1).replace('.', ',')} quilômetros`
      : `${Math.round(remainingMeters / 50) * 50} metros`;
    const minutes = Math.max(1, Math.round(remainingSeconds / 60));
    return `Faltam cerca de ${distance} e ${minutes} minutos até ${destination.name}.`;
  };

  const tripVoice = useTripVoice({
    registerStop: () => session.registerStop(),
    askRecommendation,
    describeTripProgress,
    registerTouristSpot,
    findStop: (category) => {
      const here = position?.coordinate;
      if (!here) {
        flash('Sem localização para buscar lugares por perto.');
        return;
      }
      readOptionsByVoice.current = true;
      setStopReason('Pedido por voz');
      stopOptions.search(category, here);
    },
    openEmergency: () => openEmergency(),
    endTrip: () => endTrip('voice'),
    recordCommand: (transcript, audioUri) => {
      if (!session.tripId) {
        return;
      }

      /*
        O comando vai para o diário com o áudio: a API lê a emoção da voz (RF-15,
        CA-07). Se isso falhar, grava pelo menos a frase.
      */
      sendVoiceCommand({
        tripId: session.tripId,
        transcript,
        audioUri,
        location: position?.coordinate ?? null,
      })
        .then((result) => {
          const notice = describeEmotion(result);
          if (notice) {
            flash(notice);
          }
        })
        .catch(() => {
          recordEvent(session.tripId!, {
            kind: 'command',
            command: transcript,
            location: position?.coordinate ?? null,
          }).catch(() => {});
        });
    },
  });

  /*
    Escuta contínua de "Atlas" (RF-02, CA-02). Desligada por padrão. Pausa
    enquanto o Atlas fala ou ouve um comando (só uma escuta por vez).
  */
  const wake = useWakeWord({
    onWake: (rest) => tripVoice.resume(rest),
    enabled: tripVoice.state === 'idle',
  });

  useEffect(
    () =>
      subscribeTripActions((action) => {
        if (action === 'toggle-wake') {
          wake.toggle();
        } else if (action === 'ask-recommendation') {
          askRecommendation();
        } else if (action === 'register-stop') {
          registerStop();
        } else {
          confirmEnd();
        }
      }),
    // As funções são lidas quando a ação chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wake.toggle, askRecommendation, registerStop, confirmEnd],
  );

  // As 3 opções de uma parada pedida por voz: lidas e escolhidas por voz.
  useEffect(() => {
    const places = stopOptions.result?.places;
    if (!places || !readOptionsByVoice.current) {
      return;
    }
    readOptionsByVoice.current = false;

    const intro = `Encontrei ${places.length} ${places.length === 1 ? 'opção' : 'opções'}.`;
    chooseOptionByVoice(tripVoice, places, intro)
      .then((index) => {
        if (index !== null) {
          chooseStop(places[index]);
        }
      })
      .catch(() => {});
    // Só a chegada da lista importa; as ações são lidas na hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopOptions.result]);

  /*
    Toda recomendação é falada (RF-20). Se ela pede confirmação e há
    microfone, o Atlas pergunta e ouve a resposta. Sem resposta clara, o card
    continua na tela para o toque.
  */
  const spokenRecommendation = useRef<string | null>(null);

  useEffect(() => {
    const current = recommendations.current;
    if (!current || spokenRecommendation.current === current.id) {
      return;
    }
    spokenRecommendation.current = current.id;

    (async () => {
      await tripVoice.say(current.justification);

      if (!tripVoice.available || !current.requiresConfirmation) {
        return;
      }

      const searches = DECISION_CATEGORY[current.decision] !== undefined;
      const accepted = await confirmByVoice(
        tripVoice,
        searches ? 'Quer que eu busque um lugar?' : 'Quer registrar este ponto?',
      );

      if (accepted === null) {
        return;
      }
      if (accepted && searches) {
        readOptionsByVoice.current = true;
      }
      answerRecommendation(accepted);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations.current]);

  // Tensão forte na voz: o Atlas oferece a emergência.
  useEffect(() => {
    if (!recommendations.assistance) {
      return;
    }

    tripVoice.say('Percebi tensão forte na sua voz. Quer ajuda?').catch(() => {});

    Alert.alert('Está tudo bem?', 'Percebi tensão forte na sua voz. Quer abrir a emergência?', [
      { text: 'Estou bem', style: 'cancel', onPress: recommendations.dismissAssistance },
      {
        text: 'Abrir emergência',
        onPress: () => {
          recommendations.dismissAssistance();
          openEmergency();
        },
      },
    ]);
    // Só a chegada do aviso importa; as ações são lidas no toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations.assistance]);

  const toggleFocus = () => {
    setIsFollowing((following) => {
      if (following) {
        // Vai para a visão geral: mostra a rota inteira.
        mapRef.current?.fitRoute();
      } else {
        // Volta para a navegação: câmera 3D perto do usuário.
        mapRef.current?.goToNavigation();
      }
      return !following;
    });
  };

  const presentationStopGeometry = useMemo(
    () => progressRoute ? buildRouteGeometry(progressRoute.coordinates) : null,
    [progressRoute],
  );
  const presentationStopCoordinate = (() => {
    if (!presentationStopGeometry || !progress) return null;
    return pointAlongRoute(
      presentationStopGeometry.coordinates,
      presentationStopGeometry.cumulative,
      Math.min(progress.traveledMeters + 350, presentationStopGeometry.totalMeters),
    )?.coordinate ?? null;
  })();

  const presentationNearbyResult: NearbyResponse | null = presentationStopCoordinate ? {
    category: 'descanso',
    source: 'presentation',
    fallbackReason: null,
    places: [{
      id: 'presentation-stop',
      name: PRESENTATION_STOP_NAME,
      address: 'No trajeto, a cerca de 350 m',
      ...presentationStopCoordinate,
      distanceMeters: 350,
      durationSeconds: Math.round(350 / DEMO_SPEED_METERS_PER_SECOND),
      byRoad: true,
      rating: null,
      ratingCount: null,
    }],
  } : null;

  const choosePresentationStop = () => {
    if (!presentationStopCoordinate) return;
    detour.start({
      name: PRESENTATION_STOP_NAME,
      ...presentationStopCoordinate,
      category: 'descanso',
      reason: 'Recomendação do Atlas: Descansar',
    });
    setPresentationStopOptions(false);
  };

  return (
    <View style={styles.screen}>
      <AtlasMap
        ref={mapRef}
        shape="full"
        edgePadding={MAP_EDGE_PADDING}
        currentLocation={mapLocation}
        origin={origin ?? DEMO_ORIGIN}
        destination={destination}
        routeCoordinates={trip.route?.coordinates ?? EMPTY_ROUTE}
        stops={detour.waypoints}
        // Na demonstração o ponto azul do GPS real apareceria longe da seta simulada.
        showsUserLocation={!effectiveDemo && hasPosition && !isFollowing}
        showsOriginMarker={!hasPosition}
        focus={isFollowing ? 'navigation' : 'route'}
        userHeading={mapHeading}
        routeProgressIndex={progress?.nearestIndex ?? 0}
        routeProgressPoint={onRoute ? progress?.snappedPoint : null}
      />

      {/* Camada de controles. `box-none` deixa o arrasto do mapa passar. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View
          style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            {/* A instrução ocupa toda a largura. Sem manobra, a faixa mostra o destino. */}
            <View style={styles.bannerSlot}>
              {nextManeuver && !hasArrived ? (
                <ManeuverBanner maneuver={nextManeuver} />
              ) : (
                <View style={[styles.plainBanner, shadows.raised]}>
                  <Text variant="body" numberOfLines={1}>
                    {hasArrived ? 'Você chegou' : `Em rota para ${destination.name}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Velocidade e status no canto superior esquerdo */}
            <View style={styles.speedContainer}>
              <SpeedBadge metersPerSecond={position?.speed ?? null} />
              {recommendations.isAsking || wake.watching || (isPresentation && presentationState.showListening) ? (
                <WakeStatusCard consulting={recommendations.isAsking} />
              ) : trip.isLoading ? (
                <TripStatusCard icon="routes" title="Calculando rota" busy />
              ) : detour.detour ? (
                <TripStatusCard
                  icon="map-marker-path"
                  title="Parada no caminho"
                  subtitle={detour.detour.name}
                  onCancel={detour.cancel}
                />
              ) : notice ? (
                <TripStatusCard icon="check-circle" title={notice} />
              ) : null}
            </View>
          </View>

          {/* Avisos de erro, embaixo da faixa */}
          {trip.error ? (
            <StatusMessage tone="error" message={trip.error} onRetry={trip.retry} floating />
          ) : null}

          {tracking.isStarting ? (
            <StatusMessage tone="info" message="Obtendo sua localização..." busy floating />
          ) : tracking.error ? (
            <StatusMessage
              tone="error"
              message={tracking.error}
              // Com posição o erro é passageiro; sem ela, oferece tentar de novo.
              onRetry={hasPosition ? undefined : tracking.retry}
              floating
            />
          ) : null}

          {session.status === 'error' && session.error ? (
            <StatusMessage
              tone="error"
              message={`A viagem não está sendo registrada. ${session.error}`}
              onRetry={session.retry}
              floating
            />
          ) : null}

          <VoiceIndicator voice={tripVoice} />

          {wake.error ? (
            <StatusMessage tone="error" message={wake.error} floating />
          ) : null}

          {recommendations.current ? (
            <View style={isPresentation && styles.spotlight}>
              <RecommendationCard
                recommendation={recommendations.current}
                suggestedStopName={isPresentation && DECISION_CATEGORY[recommendations.current.decision] ? PRESENTATION_STOP_NAME : undefined}
                onAccept={() => answerRecommendation(true)}
                onDecline={() => answerRecommendation(false)}
              />
            </View>
          ) : null}

          {stopOptions.category || presentationStopOptions ? (
            <View style={[styles.panel, shadows.raised, isPresentation && styles.spotlight]}>
              <Text variant="heading">Onde parar?</Text>
              {isPresentation && presentationStopOptions ? (
                <Text variant="bodySoft">Escolha uma parada para incluir no trajeto.</Text>
              ) : null}
              <NearbyOptions
                result={presentationStopOptions ? presentationNearbyResult : stopOptions.result}
                isLoading={presentationStopOptions ? !presentationNearbyResult : stopOptions.isLoading}
                error={presentationStopOptions ? null : stopOptions.error}
                onRetry={stopOptions.retry}
                onSelect={presentationStopOptions ? choosePresentationStop : chooseStop}
                actionLabel="Parar em"
              />
              <SecondaryButton label="Agora não" onPress={presentationStopOptions ? () => setPresentationStopOptions(false) : stopOptions.clear} />
            </View>
          ) : null}

          {recommendations.error ? (
            <StatusMessage tone="error" message={recommendations.error} floating />
          ) : null}

          {isEnding ? (
            <StatusMessage tone="info" message="Salvando a viagem..." busy floating />
          ) : null}

          {progress?.isOffRoute ? (
            <StatusMessage tone="info" message="Você saiu da rota." floating />
          ) : null}

          {/* Botões flutuantes à direita, abaixo dos avisos (nunca cobrem a faixa de instrução). */}
          <View style={styles.mapActions} pointerEvents="box-none">
            {session.status === 'active' ? (
              <SceneCamera
                ref={cameraRef}
                onCapture={onCameraCapture}
              />
            ) : null}

            {/* Controles da demonstração: condições do modelo, concluir e pausar. */}
            {effectiveDemo && !isPresentation ? (
              <>
                <FloatingIconButton
                  size="lg"
                  icon="flask-outline"
                  accessibilityLabel="Ajustar as condições da demonstração"
                  onPress={() => router.push('/trip-scenario')}
                />
                <FloatingIconButton
                  size="lg"
                  icon="flag-checkered"
                  accessibilityLabel="Concluir a viagem e ver o resumo"
                  onPress={concludeDemoTrip}
                />
                <FloatingIconButton
                  size="lg"
                  icon={demoDrive.isPaused ? 'play' : 'pause'}
                  accessibilityLabel={
                    demoDrive.isPaused ? 'Retomar a viagem simulada' : 'Pausar a viagem simulada'
                  }
                  onPress={demoDrive.togglePause}
                />
              </>
            ) : null}

            {/* Só num development build (no Expo Go não há reconhecimento de fala). */}
            {tripVoice.available ? (
              <FloatingIconButton
                size="lg"
                icon={tripVoice.state === 'listening' ? 'microphone' : 'microphone-outline'}
                iconColor={tripVoice.state === 'listening' ? 'danger' : 'primary'}
                accessibilityLabel={
                  tripVoice.state === 'listening' ? 'Parar de ouvir' : 'Falar com o Atlas'
                }
                accessibilityHint="Toque longo ativa ou desativa a escuta contínua"
                onPress={tripVoice.onMicPress}
                onLongPress={wake.available ? wake.toggle : undefined}
              />
            ) : null}

            <FloatingIconButton
              size="lg"
              icon={isFollowing ? 'map-outline' : 'crosshairs-gps'}
              accessibilityLabel={
                isFollowing
                  ? 'Ver o trajeto inteiro no mapa'
                  : 'Voltar a acompanhar minha posição'
              }
              onPress={toggleFocus}
            />

            <FloatingIconButton
              size="lg"
              icon="dots-horizontal"
              accessibilityLabel="Abrir ações da viagem"
              testID="trip-actions-button"
              onPress={() =>
                router.push({ pathname: '/trip-actions', params: { watching: wake.watching ? '1' : '0' } })
              }
            />


            {/* Emergência sempre à mão, com ou sem viagem registrada (§11). */}
            <FloatingIconButton
              size="lg"
              icon="alarm-light"
              iconColor="danger"
              accessibilityLabel="Emergência: Hospital, SAMU 192 e Polícia 190"
              onPress={openEmergency}
            />
          </View>
        </View>

        <TripBottomSheet
          remainingSeconds={remainingSeconds}
          remainingMeters={remainingMeters}
          bottomInset={insets.bottom}
          onEndTrip={confirmEnd}
        />
      </View>

      {isPresentation && (
        <PresentationOverlay
          demoDrive={demoDrive}
          stopReached={detour.reached !== null}
          onTriggerRecommendation={askRecommendation}
          onAcceptRecommendation={() => answerRecommendation(true)}
          onSelectPlace={(index) => {
            const places = stopOptions.result?.places;
            if (places && places[index]) {
              chooseStop(places[index]);
            }
          }}
          onSetNearbyStop={choosePresentationStop}
          onCompleteTrip={concludeDemoTrip}
          onDemoVoice={() => {
            setPresentationState({ caption: `Atlas: ${describeTripProgress()}` });
            return tripVoice.demoCommand('quanto falta para chegar');
          }}
          initialAct={skipIntro ? 2 : 1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Cobre o mapa: controles no topo, painel embaixo e o mapa livre no meio. */
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  top: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  bannerSlot: {
    alignSelf: 'stretch',
  },
  /** Velocidade no canto superior esquerdo, abaixo da faixa. */
  speedContainer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Botões alinhados à direita, abaixo da faixa de instrução. */
  mapActions: {
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  /** Painel de escolha dos 3 lugares, sobre o mapa. */
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  /** Faixa simples quando não há manobra para mostrar. */
  plainBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minHeight: 44,
  },
  /** Deixa o elemento acima da camada escura do modo apresentação. */
  spotlight: {
    zIndex: 100,
  },
});
