"""
Limite diário de consultas a uma API paga ou com cota.

É a primeira barreira, dentro da API do Atlas; a segunda, que vale mesmo com
a API reiniciada, é a cota configurada no painel do fornecedor (ver README).
"""

from collections.abc import Callable
from datetime import date


class DailyBudget:
    """Quantas consultas ainda cabem hoje. Zera na virada do dia."""

    def __init__(self, limit: int, today: Callable[[], date] = date.today) -> None:
        self._limit = limit
        self._today = today
        self._day = today()
        self._used = 0

    def try_spend(self) -> bool:
        if self._today() != self._day:
            self._day, self._used = self._today(), 0

        if self._used >= self._limit:
            return False

        self._used += 1
        return True

    @property
    def remaining(self) -> int:
        return max(0, self._limit - self._used)
