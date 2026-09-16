import { AppTabs } from '@/components/ui/app-tabs';

/**
 * Grupo das abas. A barra nativa vive aqui, e não na raiz, para que telas
 * empilhadas (como a viagem) apareçam por cima dela em vez de dentro dela.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
