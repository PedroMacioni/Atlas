"""
Regras de rotulagem do dataset sintético — o conhecimento da equipe.

O Random Forest aprende a partir de exemplos, e os exemplos sintéticos recebem
o rótulo destas regras. Elas são, portanto, a definição de comportamento do
Atlas: mudar uma regra aqui e retreinar muda o que o copiloto recomenda.

A documentação legível, com a justificativa de cada limiar, está em
`ml/RULES.md`. Os dois precisam andar juntos.

As regras são avaliadas **em ordem de prioridade** — segurança primeiro. A
primeira que casar decide o rótulo.

Variabilidade: cada exemplo sintético usa limiares ligeiramente diferentes
(`Thresholds.jittered`), como motoristas diferentes cansam em momentos
diferentes. É isso que impede o modelo de apenas decorar um corte exato.
"""

import random
from dataclasses import dataclass, replace

from app.ml.features import TripContext

# Janelas de refeição, em hora decimal.
LUNCH = (11.5, 14.0)
DINNER = (18.5, 21.0)


@dataclass(frozen=True)
class Thresholds:
    # DESCANSAR
    tired_without_stop_min: float = 90
    night_without_stop_min: float = 120
    # FAZER UMA PARADA (tensão/raiva)
    tense_without_stop_min: float = 60
    # ABASTECER — proxy de autonomia, ver "Limitação" em RULES.md
    fuel_distance_km: float = 400
    fuel_distance_with_station_km: float = 250
    fuel_min_without_stop_min: float = 60
    # ALIMENTAR-SE
    meal_without_stop_min: float = 120
    meal_trip_min: float = 90
    meal_with_restaurant_without_stop_min: float = 60
    # FAZER UMA PARADA (tempo)
    generic_without_stop_min: float = 150

    def jittered(self, rng: random.Random, spread: float = 0.15) -> "Thresholds":
        """Os mesmos limiares, cada um deslocado em até ±15%."""
        return replace(
            self,
            **{
                name: value * rng.uniform(1 - spread, 1 + spread)
                for name, value in self.__dict__.items()
            },
        )


DEFAULT_THRESHOLDS = Thresholds()


def is_night(hour: float) -> bool:
    return hour >= 22 or hour < 5


def is_meal_time(hour: float) -> bool:
    return LUNCH[0] <= hour < LUNCH[1] or DINNER[0] <= hour < DINNER[1]


def label(context: TripContext, t: Thresholds = DEFAULT_THRESHOLDS) -> str:
    """O rótulo que a equipe daria para esta situação."""
    since_stop = context.minutes_since_stop
    emotion = context.emotion
    image = context.image

    # 1. DESCANSAR — cansaço é o risco mais grave ao volante.
    if emotion == "cansado" and since_stop >= t.tired_without_stop_min:
        return "descansar"
    if is_night(context.hour) and since_stop >= t.night_without_stop_min:
        return "descansar"

    # 2. FAZER UMA PARADA — tensão ou raiva pedem uma pausa curta para baixar.
    if emotion in ("tenso", "bravo") and since_stop >= t.tense_without_stop_min:
        return "fazer_parada"

    # 3. ABASTECER — pela distância, já que não há sensor de combustível.
    if (
        context.distance_km >= t.fuel_distance_km
        and since_stop >= t.fuel_min_without_stop_min
    ):
        return "abastecer"
    if image == "posto" and context.distance_km >= t.fuel_distance_with_station_km:
        return "abastecer"

    # 4. ALIMENTAR-SE — horário de refeição com a viagem já longa.
    if is_meal_time(context.hour):
        if image == "restaurante" and since_stop >= t.meal_with_restaurant_without_stop_min:
            return "alimentar"
        if since_stop >= t.meal_without_stop_min and context.trip_minutes >= t.meal_trip_min:
            return "alimentar"

    # 5. REGISTRAR PONTO TURÍSTICO — só com o motorista em bom estado.
    if image == "ponto_turistico" and emotion in ("animado", "neutro", "desconhecido"):
        return "registrar_ponto_turistico"

    # 6. FAZER UMA PARADA — tempo demais sem parar, qualquer que seja o motivo.
    if since_stop >= t.generic_without_stop_min:
        return "fazer_parada"

    return "continuar"
