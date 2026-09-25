import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import { getDeviceId } from '@/features/device/services/device-id';
import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import type {
  EndReason,
  EventKind,
  TripCard,
  TripDetail,
  TripEvent,
  TripStop,
} from '@/features/trip-session/types/trip';
import { HttpError, fetchJson, type FetchJsonOptions } from '@/utils/http';

/**
 * Chamadas de viagem ao backend: início, diário, paradas, fim e histórico.
 *
 * Sem API configurada nada disso existe (o histórico fica no banco, não no
 * celular). A viagem continua navegável, só não é registrada.
 */
const TRIPS_PATH = '/v1/trips';

/** Leituras de histórico podem demorar um pouco mais que uma rota. */
const TIMEOUT_MS = 15_000;

export function isTripHistoryAvailable(): boolean {
  return isAtlasApiConfigured();
}

/**
 * Faz uma chamada em `/v1/trips`, sempre com o id anônimo do aparelho no
 * cabeçalho. Usada também pelas recomendações, câmera e voz.
 */
export async function tripApiRequest<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const deviceId = await getDeviceId();

  return fetchJson<T>(atlasApiUrl(`${TRIPS_PATH}${path}`), {
    timeoutMs: TIMEOUT_MS,
    ...options,
    headers: { 'X-Atlas-Device': deviceId, ...options.headers },
  });
}

export function startTrip(origin: NamedCoordinate, destination: NamedCoordinate) {
  return tripApiRequest<TripDetail>('', { method: 'POST', body: { origin, destination } });
}

export type StopDetails = {
  /** Nome do lugar (ex.: "Posto Taquaral"). Sem ele, a API grava "Parada". */
  name?: string;
  category?: string;
  reason?: string;
};

export function addStop(tripId: string, location: Coordinate, details: StopDetails = {}) {
  return tripApiRequest<TripStop>(`/${tripId}/stops`, {
    method: 'POST',
    body: { location, ...details },
  });
}

export type RecordEventParams = {
  kind: EventKind;
  command?: string;
  location?: Coordinate | null;
};

export function recordEvent(tripId: string, { kind, command, location }: RecordEventParams) {
  return tripApiRequest<TripEvent>(`/${tripId}/events`, {
    method: 'POST',
    body: { kind, command, location: location ?? undefined },
  });
}

export type FinishTripParams = {
  endReason: EndReason;
  distanceMeters: number;
  path: Coordinate[];
  location?: Coordinate | null;
  /** Quando a viagem terminou. Sem valor, a API usa a hora dela (o certo numa viagem real). */
  endedAt?: string;
};

export function finishTrip(tripId: string, params: FinishTripParams) {
  return tripApiRequest<TripDetail>(`/${tripId}/finish`, {
    method: 'POST',
    body: { ...params, location: params.location ?? undefined },
  });
}

export async function listTrips(signal?: AbortSignal): Promise<TripCard[]> {
  const payload = await tripApiRequest<{ trips?: TripCard[] }>('', { signal });
  return Array.isArray(payload.trips) ? payload.trips : [];
}

export function getTrip(tripId: string, signal?: AbortSignal) {
  return tripApiRequest<TripDetail>(`/${tripId}`, { signal });
}

/** Mensagem para a tela quando uma chamada deste serviço falha. */
export function describeTripError(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'trip_not_found':
        return 'Viagem não encontrada.';
      case 'trip_already_finished':
        return 'Esta viagem já foi encerrada.';
    }

    switch (error.kind) {
      case 'timeout':
        return 'A API do Atlas demorou demais para responder.';
      case 'network':
        return 'Sem conexão com a API do Atlas.';
      default:
        return 'A API do Atlas não conseguiu registrar a viagem.';
    }
  }

  return 'Falha inesperada ao falar com a API do Atlas.';
}
