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
import {
  DEMO_DRIVE_DESTINATION,
  DEMO_DRIVE_ORIGIN,
} from '@/features/demo/constants/demo-drive';
import { useDemoDrive } from '@/features/demo/hooks/use-demo-drive';
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
import type { NearbyPlace } from '@/features/nearby/types/nearby';
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
import { VoiceIndicator } from '@/features/voice/components/voice-indicator';
import {
  describeEmotion,
  sendVoiceCommand,
} from '@/features/voice/services/voice-command-service';
import { useTripVoice } from '@/features/voice/hooks/use-trip-voice';
import { useWakeWord } from '@/features/voice/hooks/use-wake-word';
import { chooseOptionByVoice, confirmByVoice } from '@/features/voice/utils/voice-dialogs';
import { PresentationOverlay } from '@/features/presentation';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';
import { spacing } from '@/theme/spacing';

const EMPTY_ROUTE: never[] = [];

/**
 * Respiro que a câmera reserva ao enquadrar a rota.
 *
 * A faixa de instrução e o painel inferior cobrem parte do mapa; sem isso o
 * trajeto seria enquadrado atrás deles.
 */
const MAP_EDGE_PADDING = { top: 150, bottom: 210, left: 56, right: 56 };

/** Quanto tempo a confirmação "Parada registrada" fica na tela. */
const NOTICE_MS = 2_500;

/**
 * Viagem em andamento.
 *
 * O mapa **é** a tela: encosta nas quatro bordas, e o resto flutua sobre ele —
 * a instrução da próxima manobra no topo, o painel de chegada embaixo. É o
 * arranjo dos aplicativos de navegação, e a razão é a mesma: dirigindo, o que
 * se olha é o mapa, e todo o resto precisa caber na periferia da atenção.
 *
 * Por isso o cabeçalho nativo sai daqui (`headerShown: false`, em
 * `_layout.tsx`) e a tela traz o próprio botão de voltar.
 *
 * O painel inferior responde à pergunta que se faz numa viagem — **a que horas
 * eu chego?** — e por isso o horário vem primeiro, centralizado. Tempo e
 * distância ficam abaixo, menores, separados por um ponto.
 *
 * A tela apenas compõe: localização, rota, progresso, manobras e apresentação
 * vivem cada um em sua própria feature.
 */
export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AtlasMapHandle>(null);
  const cameraRef = useRef<SceneCameraHandle>(null);

  /*
    Modo de demonstração (`atlas://trip?demo=1`): o trajeto é o de sempre —
    origem, destino e rota vêm da mesma API —, mas a posição não vem do GPS.
    Um ponto caminha sobre a rota, já na metade dela, e a tela inteira acredita
    nele. É o que permite mostrar a viagem em andamento sem dirigir 110 km.
  */
  const { demo: demoParam, presentation: presentationParam } = useLocalSearchParams<{
    demo?: string;
    presentation?: string;
  }>();
  const isDemo = demoParam === '1';
  const isPresentation = presentationParam === '1';

  // Presentation mode implies demo mode
  const effectiveDemo = isDemo || isPresentation;

  const chosenDestination = useTripDestination();
  const destination = effectiveDemo ? DEMO_DRIVE_DESTINATION : chosenDestination;

  const tracking = useLocationTracking(!effectiveDemo);
  const gpsOrigin = useTripOrigin(tracking.position?.coordinate ?? null, tracking.isStarting);
  const origin = effectiveDemo ? DEMO_DRIVE_ORIGIN : gpsOrigin;

  /*
    A rota chega à demonstração por um estado, e não direto de `useTripRoute`:
    a posição simulada nasce da rota, e a rota — por causa do desvio — nasce da
    posição. Um render de atraso desfaz o laço.
  */
  const [demoRoute, setDemoRoute] = useState<RouteResult | null>(null);
  const demoDrive = useDemoDrive(effectiveDemo, demoRoute);

  const position = effectiveDemo ? demoDrive.position : tracking.position;

  const session = useTripSession({ origin, destination, position });

  const [notice, setNotice] = useState<string | null>(null);

  /** Mostra um aviso curto sob a faixa de instrução. */
  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), NOTICE_MS);
  };

  /*
    Parada no caminho — de uma recomendação aceita ou de um hospital escolhido
    na emergência. Ao alcançá-la, vira parada no diário com o nome do lugar.
  */
  const detour = useDetour(position?.coordinate ?? null, (reached) => {
    session
      .registerStop({ name: reached.name, category: reached.category, reason: reached.reason })
      .then(() => flash(`Parada registrada: ${reached.name}.`))
      .catch(() => flash(`Você chegou a ${reached.name}.`));
  });

  const trip = useTripRoute(detour.routeOrigin ?? origin, destination, detour.waypoints);
  const progress = useTripProgress(trip.route, position?.coordinate ?? null);

  /*
    Derivar durante a renderização, e não num efeito: é o padrão do resto da
    viagem, e evita um quadro com o carro na rota antiga.

    Só a rota pronta entra. Enquanto o desvio é calculado, `trip.route` volta a
    ser nulo por alguns segundos, e adotar esse nulo faria o carro desaparecer
    do mapa no meio da demonstração — ele continua andando no trajeto anterior
    até o novo chegar.
  */
  if (effectiveDemo && trip.route && demoRoute !== trip.route) {
    setDemoRoute(trip.route);
  }

  // Cada demonstração começa do cenário do escopo, e não do que ficou da
  // anterior.
  useEffect(() => {
    if (effectiveDemo) {
      resetDemoScenario();
    }
  }, [effectiveDemo]);

  /*
    A distância que o modelo vê começa sendo a que o carro simulado já andou —
    é o que torna as 6 variáveis coerentes com o que está na tela. Depois disso
    ela é de quem mexe na folha de condições.
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
  }, [isDemo, demoDrive.traveledMeters]);

  // Os 3 locais para uma recomendação aceita (RF-19).
  const stopOptions = useNearbySearch();
  const [stopReason, setStopReason] = useState('');

  const recommendations = useRecommendations({
    tripId: session.tripId,
    // Na demonstração quem sabe a distância é o carro simulado: o diário da
    // sessão só soma o que o GPS andou, e o GPS não andou.
    traveledMeters: effectiveDemo ? demoDrive.traveledMeters : session.traveledMeters,
    location: position?.coordinate ?? null,
  });

  /**
   * Pede a avaliação ao Random Forest.
   *
   * Na demonstração vão junto as condições da folha de cenário — uma hora de
   * estrada, cansaço na voz —, e a API responde com o modelo de verdade sobre
   * variáveis escolhidas à mão. As condições são lidas no momento do toque,
   * que é quando elas valem.
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
   * Próxima manobra à frente.
   *
   * Sem progresso — antes da primeira leitura do GPS, ou com o sinal ainda
   * ruim — a manobra que interessa é a **primeira do trajeto**, e não nenhuma:
   * a faixa precisa aparecer assim que a rota chega, senão quem abre a tela
   * parado conclui que a instrução não funciona.
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
    O que o mapa desenha como "você" (RF-07).

    Em rota, é a posição **projetada sobre o trajeto**, e não a leitura crua do
    GPS: é o que mantém a seta em cima da via em vez de na calçada ou na
    pista contrária. E a direção é a da rua em que se está, não a do aparelho,
    que treme com o carro parado e some em velocidade baixa. Fora da rota as
    duas coisas voltam a ser as do GPS — ali a rota não tem o que dizer.
  */
  const onRoute = progress !== null && !progress.isOffRoute;
  const mapLocation = onRoute ? progress.snappedPoint : (position?.coordinate ?? null);
  const mapHeading = (onRoute ? progress.courseDegrees : null) ?? position?.heading ?? null;

  // Sem posição, os totais do trajeto são a melhor verdade disponível.
  const remainingMeters = progress?.remainingMeters ?? trip.route?.distanceMeters ?? 0;
  const remainingSeconds = progress?.remainingSeconds ?? trip.route?.durationSeconds ?? 0;

  /**
   * Encerra a viagem e abre o resumo.
   *
   * Sem API a viagem não foi registrada, e sair é tudo o que há a fazer. Com
   * API, uma falha ao salvar não prende ninguém na tela: oferece tentar de
   * novo ou sair sem o resumo.
   */
  const endTrip = async (reason: EndReason, override?: FinishOverride) => {
    if (isEnding) {
      return;
    }

    setIsEnding(true);

    try {
      const tripId = await session.finish(reason, override);

      if (tripId) {
        router.replace({ pathname: '/history/[id]', params: { id: tripId } });
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
   * "Cheguei": conclui a demonstração como se o trajeto inteiro tivesse sido
   * dirigido.
   *
   * O resumo precisa de três coisas que o carro simulado sabe e o diário da
   * sessão não: o caminho completo — incluindo os trechos anteriores a cada
   * desvio —, a distância somada sobre ele, e um fim de viagem coerente com o
   * tempo que a rota leva, em vez dos poucos minutos que a demonstração
   * passou aberta.
   */
  const concludeDemoTrip = () => {
    const complete = demoDrive.completeTrip();

    if (complete.path.length < 2) {
      flash('A rota ainda não chegou.');
      return;
    }

    const endedAt = session.startedAt
      ? new Date(Date.parse(session.startedAt) + complete.durationSeconds * 1_000).toISOString()
      : undefined;

    endTrip('arrival', {
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
   * Chegada ao destino: o Atlas pergunta uma vez se deve encerrar (RF-25).
   * Encerrar sozinho seria arriscado — o GPS reconhece a chegada a 40 m, e
   * ainda pode faltar achar a vaga. O ref garante uma pergunta por viagem.
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
   * Resposta à recomendação (§4.7, CA-10).
   *
   * - DESCANSAR, ABASTECER, ALIMENTAR-SE e FAZER UMA PARADA buscam as 3 opções
   *   próximas; a rota só muda quando o usuário escolhe uma delas.
   * - REGISTRAR PONTO TURÍSTICO grava o local no diário na hora.
   * - CONTINUAR não mexe em nada.
   */
  const answerRecommendation = (accepted: boolean) => {
    const current = recommendations.current;
    const decision = current?.decision;
    const here = position?.coordinate ?? null;

    recommendations.answer(accepted).catch(() => {});

    const category = decision ? DECISION_CATEGORY[decision] : undefined;
    if (accepted && category && here) {
      setStopReason(`Recomendação do Atlas: ${current?.label}`);
      stopOptions.search(category, here);
    }

    if (accepted && decision === 'registrar_ponto_turistico') {
      registerTouristSpot().catch(() => {});
    }
  };

  /**
   * "Registrar ponto turístico": foto, classe e local no diário (RF-11,
   * RF-22).
   *
   * Com a câmera pronta, a foto é tirada e classificada — é ela que aparece
   * no resumo final. Sem câmera, sem permissão ou com a IA de imagem fora do
   * ar, o registro acontece assim mesmo, só com o local: o escopo pede a
   * marcação do ponto, e a foto é o que a enriquece.
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

  /** Chamado após o usuário tirar a foto na câmera fullscreen. */
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

  /** O local escolhido vira parada no caminho; o destino continua o mesmo. */
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
    Voz (RF-11, RF-12, RF-20). Um toque no microfone, uma frase, uma ação. As
    buscas de parada pedidas por voz têm as 3 opções lidas em voz alta e
    escolhidas por voz (RF-13, RF-14) — o ref marca que a próxima lista de
    opções nasceu de um pedido falado.
  */
  const readOptionsByVoice = useRef(false);

  const tripVoice = useTripVoice({
    registerStop: () => session.registerStop(),
    askRecommendation,
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
        O comando vai para o diário com o áudio: a API lê a emoção da voz e
        grava as duas coisas no mesmo evento (RF-15, CA-07). Sem áudio — ou
        com a API fora — resta gravar a frase, que é o que importa primeiro.
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
    "Diga Atlas" sem tirar a mão do volante (RF-02, CA-02). Desligada por
    padrão, como na tela inicial: é escolha de quem dirige. Enquanto o Atlas
    fala ou ouve um comando, a vigília sai de cena — o reconhecedor do
    sistema só aceita uma sessão por vez.
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
    // As funções são lidas quando a ação chega; reinscrever a cada render não
    // melhora a entrega e pode trocar o listener enquanto o sheet fecha.
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
    // Só a chegada da lista importa; as ações são lidas no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopOptions.result]);

  /*
    Toda recomendação é falada (RF-20). Se pede confirmação e há microfone, o
    Atlas pergunta e ouve a resposta — o motorista não precisa tirar a mão do
    volante. Sem resposta clara, o card continua na tela para o toque.
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

  // Tensão forte: o Atlas oferece a emergência antes de qualquer recomendação.
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
        // Indo para overview: enquadra a rota inteira
        mapRef.current?.fitRoute();
      } else {
        // Voltando para navegação: câmera 3D próxima ao usuário
        mapRef.current?.goToNavigation();
      }
      return !following;
    });
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
        // O ponto azul nativo é o do GPS de verdade: na demonstração ele
        // apareceria onde o aparelho está, longe da seta, como se houvesse
        // dois "você" no mapa.
        showsUserLocation={!effectiveDemo && hasPosition && !isFollowing}
        showsOriginMarker={!hasPosition}
        focus={isFollowing ? 'navigation' : 'route'}
        userHeading={mapHeading}
        routeProgressIndex={progress?.nearestIndex ?? 0}
      />

      {/* Camada de controles. `box-none` deixa o arrasto do mapa passar. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View
          style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            {/*
              A instrução ocupa toda a largura. Sem manobra em mãos, a faixa
              mostra o destino: um espaço reservado e vazio seria pior que uma
              faixa que diz para onde se vai.
            */}
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

            {/* Velocidade no canto superior esquerdo */}
            <View style={styles.speedContainer}>
              <SpeedBadge metersPerSecond={position?.speed ?? null} />
            </View>
          </View>

          {/* Avisos empilham sob a faixa, sem empurrar o mapa. */}
          {trip.error ? (
            <StatusMessage tone="error" message={trip.error} onRetry={trip.retry} floating />
          ) : trip.isLoading ? (
            <StatusMessage tone="info" message="Calculando rota..." busy floating />
          ) : null}

          {tracking.isStarting ? (
            <StatusMessage tone="info" message="Obtendo sua localização..." busy floating />
          ) : tracking.error ? (
            <StatusMessage
              tone="error"
              message={tracking.error}
              // Com posição em mãos o erro é passageiro e o acompanhamento
              // segue da última leitura boa; sem ela, vale oferecer a retomada.
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

          {notice ? <StatusMessage tone="info" message={notice} floating /> : null}

          {wake.watching ? (
            <StatusMessage
              tone="info"
              message={wake.heard || 'Atento — é só dizer "Atlas".'}
              floating
            />
          ) : wake.error ? (
            <StatusMessage tone="error" message={wake.error} floating />
          ) : null}

          {recommendations.current ? (
            <View style={isPresentation && styles.spotlight}>
              <RecommendationCard
                recommendation={recommendations.current}
                onAccept={() => answerRecommendation(true)}
                onDecline={() => answerRecommendation(false)}
              />
            </View>
          ) : null}

          {stopOptions.category ? (
            <View style={[styles.panel, shadows.raised, isPresentation && styles.spotlight]}>
              <Text variant="heading">Onde parar?</Text>
              <NearbyOptions
                result={stopOptions.result}
                isLoading={stopOptions.isLoading}
                error={stopOptions.error}
                onRetry={stopOptions.retry}
                onSelect={chooseStop}
                actionLabel="Parar em"
              />
              <SecondaryButton label="Agora não" onPress={stopOptions.clear} />
            </View>
          ) : null}

          {detour.detour ? (
            <StatusMessage
              tone="info"
              message={`Parada no caminho: ${detour.detour.name}`}
              onRetry={detour.cancel}
              retryLabel="Cancelar parada"
              floating
            />
          ) : null}

          {recommendations.isAsking ? (
            <StatusMessage tone="info" message="Consultando o Atlas..." busy floating />
          ) : recommendations.error ? (
            <StatusMessage tone="error" message={recommendations.error} floating />
          ) : null}

          {isEnding ? (
            <StatusMessage tone="info" message="Salvando a viagem..." busy floating />
          ) : null}

          {progress?.isOffRoute ? (
            <StatusMessage tone="info" message="Você saiu da rota." floating />
          ) : null}

          {/*
            O controle de câmera é um ícone sobre o mapa, e não um botão no
            painel: é onde os aplicativos de navegação o colocam. Fica no alto,
            à direita, logo abaixo dos avisos — assim nunca cobre a faixa de
            instrução, que é o elemento mais importante da tela.
          */}
          <View style={styles.mapActions} pointerEvents="box-none">
            {session.status === 'active' ? (
              <SceneCamera
                ref={cameraRef}
                onCapture={onCameraCapture}
              />
            ) : null}

            {/*
              Controles da demonstração: as condições que o Random Forest vai
              ver, e o pause — para a tela ficar parada na hora da foto.
            */}
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

            {/* Só num development build: no Expo Go não há reconhecimento de fala. */}
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
          onTriggerRecommendation={askRecommendation}
          onAcceptRecommendation={() => answerRecommendation(true)}
          onSelectPlace={(index) => {
            const places = stopOptions.result?.places;
            if (places && places[index]) {
              chooseStop(places[index]);
            }
          }}
          onSetNearbyStop={() => {
            // Calcula uma parada ~800m à frente da posição atual
            const here = position?.coordinate;
            if (!here || !destination) return;

            // Direção para o destino (normalizada)
            const dLat = destination.latitude - here.latitude;
            const dLng = destination.longitude - here.longitude;
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);

            // ~800m em graus (aproximadamente 0.0072 graus)
            const offset = 0.0072;
            const stopLat = here.latitude + (dLat / dist) * offset;
            const stopLng = here.longitude + (dLng / dist) * offset;

            detour.start({
              name: 'Posto Shell Bandeirantes',
              latitude: stopLat,
              longitude: stopLng,
              category: 'descanso',
              reason: 'Recomendação do Atlas: Descansar',
            });
            stopOptions.clear();
          }}
          onCompleteTrip={concludeDemoTrip}
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
  /**
   * Cobre o mapa inteiro e distribui os dois blocos — controles no topo,
   * painel no rodapé — com o espaço livre no meio, que é onde o mapa fica
   * visível e arrastável.
   */
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
  /** Velocidade no canto superior esquerdo, abaixo da faixa de direção. */
  speedContainer: {
    alignSelf: 'flex-start',
  },
  /** Alinha o controle de câmera à direita, sob a faixa de instrução. */
  mapActions: {
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  /** Painel de escolha dos 3 locais, sobre o mapa. */
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  /** Faixa de contexto quando não há manobra para anunciar. */
  plainBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minHeight: 44,
  },
  /** Eleva o componente acima do overlay de spotlight da apresentação. */
  spotlight: {
    zIndex: 100,
  },
});
