"""
Base dos corpos de resposta.

O JSON sai em camelCase porque quem consome é TypeScript: `distanceMeters`, e
não `distance_meters`. O Python de dentro continua em snake_case, e a tradução
acontece só na borda — uma regra declarada uma vez, e não um `alias` repetido
campo a campo.

`populate_by_name` mantém a construção pelos nomes Python, que é como os
serviços e os testes montam os objetos.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )
