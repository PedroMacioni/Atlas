"""
Modelo base das respostas.

O JSON sai em camelCase (`distanceMeters`) porque quem lê é o app em
TypeScript. No Python os nomes continuam em snake_case (`distance_meters`);
a conversão é automática.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )
