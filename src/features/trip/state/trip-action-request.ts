export type TripActionRequest = 'toggle-wake' | 'ask-recommendation' | 'register-stop' | 'end-trip';

type Listener = (action: TripActionRequest) => void;

const listeners = new Set<Listener>();

/** Envia uma ação do menu de ações para a tela de viagem, que continua aberta por baixo. */
export function requestTripAction(action: TripActionRequest) {
  listeners.forEach((listener) => listener(action));
}

/** Recebe as ações enquanto a tela de viagem está aberta. */
export function subscribeTripActions(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
