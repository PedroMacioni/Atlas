import type { MapStyleElement } from 'react-native-maps';

/**
 * Estilo claro do mapa, alinhado ao design de referência: base quase branca,
 * água em azul suave, vegetação em verde pálido e rótulos comerciais
 * suprimidos para que a rota seja o único elemento forte.
 *
 * ⚠️ Limitação de plataforma: `customMapStyle` só é aplicado no Android e, no
 * iOS, apenas quando o provider é o Google Maps. No Expo Go o iOS usa Apple
 * Maps, então o iPhone mostra o mapa padrão do sistema — o restante da tela
 * segue idêntico. Para igualar o iOS será preciso um development build com
 * chave própria do Google Maps.
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
