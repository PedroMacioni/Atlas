/** Ponto geográfico em graus decimais (WGS 84). */
export type Coordinate = {
  latitude: number;
  longitude: number;
};

/** Coordenada com um rótulo legível, usada para origem e destino. */
export type NamedCoordinate = Coordinate & {
  name: string;
};
