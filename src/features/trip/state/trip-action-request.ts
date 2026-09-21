export type TripActionRequest = 'toggle-wake' | 'ask-recommendation' | 'register-stop' | 'end-trip';

type Listener = (action: TripActionRequest) => void;

const listeners = new Set<Listener>();

/** Entrega uma ação do sheet nativo à corrida que continua aberta por baixo. */
export function requestTripAction(action: TripActionRequest) {
  listeners.forEach((listener) => listener(action));
}

/** Assina comandos enquanto a tela de corrida está montada. */
export function subscribeTripActions(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
