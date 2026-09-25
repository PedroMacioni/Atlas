import type { MapStyleElement } from 'react-native-maps';

/**
 * Estilo claro do mapa: fundo quase branco, água azul suave, verde claro e
 * nomes de comércio escondidos, para a rota ser o destaque.
 *
 * Obs.: `customMapStyle` só funciona no Android (e no iOS com Google Maps). No
 * iPhone, com Apple Maps, aparece o mapa padrão do sistema.
 */
export const ATLAS_MAP_STYLE: MapStyleElement[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#F5F7FA' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7A8CA6' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E5EBF5' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#EDF4EC' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#DDEEDC' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#FDFDFE' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#FFF4E0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#F3E2C0' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#CFE2F7' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8FAFD4' }],
  },
];
