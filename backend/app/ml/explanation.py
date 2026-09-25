"""
Monta a justificativa da recomendação em português (escopo §4.5, RNF-08).

Pega as variáveis que mais pesaram na decisão e escreve uma frase com os
valores reais da viagem, por exemplo:

    Recomendação: DESCANSAR. Motivo: você parece cansado, está há 2h10 sem
    parar e viaja há 2h40.

O texto só cita as variáveis que o modelo realmente usou nesta decisão.
"""

from app.ml.features import TripContext

# Nome de cada decisão como aparece no escopo (§4.4).
DECISION_LABELS = {
    "continuar": "CONTINUAR",
    "descansar": "DESCANSAR",
    "abastecer": "ABASTECER",
    "alimentar": "ALIMENTAR-SE",
    "registrar_ponto_turistico": "REGISTRAR PONTO TURÍSTICO",
    "fazer_parada": "FAZER UMA PARADA",
}

JUST_STARTED = "a viagem acabou de começar"

# Contribuições menores que isso são ruído e não entram no texto.
MIN_CONTRIBUTION = 0.02
MAX_REASONS = 3


def format_minutes(minutes: float) -> str:
    total = max(0, round(minutes))

    if total < 60:
        return f"{total} min"

    hours, rest = divmod(total, 60)
    return f"{hours}h{rest:02d}" if rest else f"{hours}h"


def _clock(hour: float) -> str:
    hours = int(hour) % 24
    minutes = int(round((hour - int(hour)) * 60)) % 60
    return f"{hours:02d}h{minutes:02d}"


def _reason(variable: str, context: TripContext) -> str | None:
    """Frase de uma variável, ou `None` se ela não tem nada a dizer."""
    match variable:
        case "emocao":
            return {
                "cansado": "você parece cansado",
                "tenso": "sua voz indica tensão",
                "bravo": "sua voz indica irritação",
                "animado": "você está animado",
                "neutro": "você está tranquilo",
            }.get(context.emotion)
        case "imagem":
            return {
                "posto": "há um posto de combustível à vista",
                "restaurante": "há um restaurante à vista",
                "ponto_turistico": "há um ponto turístico à vista",
                "estrada": "a estrada segue livre",
            }.get(context.image)
        case "tempo_sem_parada":
            if context.minutes_since_stop < 5:
                # "Parou há 0 min" não ajuda ninguém: melhor dizer o que aconteceu.
                return JUST_STARTED if context.trip_minutes < 5 else "acabou de parar"
            if context.minutes_since_stop >= 60:
                return f"está há {format_minutes(context.minutes_since_stop)} sem parar"
            return f"parou há {format_minutes(context.minutes_since_stop)}"
        case "tempo_viagem":
            if context.trip_minutes < 15:
                return JUST_STARTED
            return f"viaja há {format_minutes(context.trip_minutes)}"
        case "distancia":
            return f"já percorreu {context.distance_km:.0f} km"
        case "horario":
            hour = context.hour
            if 11.5 <= hour < 14 or 18.5 <= hour < 21:
                return f"são {_clock(hour)}, horário de refeição"
            if hour >= 22 or hour < 5:
                return f"são {_clock(hour)}, horário noturno"
            return f"são {_clock(hour)}"
    return None


def _join(parts: list[str]) -> str:
    if len(parts) == 1:
        return parts[0]
    return f"{', '.join(parts[:-1])} e {parts[-1]}"


def explain(decision: str, contributions: dict[str, float], context: TripContext) -> str:
    """Justificativa de uma decisão, pronta para mostrar e falar."""
    ranked = sorted(contributions.items(), key=lambda item: item[1], reverse=True)

    reasons = []
    for variable, weight in ranked:
        if weight < MIN_CONTRIBUTION or len(reasons) >= MAX_REASONS:
            break
        sentence = _reason(variable, context)
        # Duas variáveis podem gerar a mesma frase ("a viagem acabou de começar").
        if sentence and sentence not in reasons:
            reasons.append(sentence)

    label = DECISION_LABELS[decision]

    if not reasons:
        # Nenhuma variável se destacou: a decisão veio do padrão geral.
        return f"Recomendação: {label}. Motivo: a situação da viagem está dentro do esperado."

    return f"Recomendação: {label}. Motivo: {_join(reasons)}."
