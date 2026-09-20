import { defineConfig } from 'vitest/config';

/**
 * Testes das funções puras do aplicativo (§16, "evidências de teste").
 *
 * Só o que não depende do React Native entra aqui: progresso na rota,
 * geometria, formatação, análise de comandos de voz, filtro de lugares e os
 * últimos destinos. É onde mora a lógica que erra em silêncio — uma distância
 * mal somada não quebra a tela, só mostra o número errado.
 *
 * Componentes e telas ficam de fora de propósito: testá-los exigiria o
 * runtime do React Native, e o retorno seria menor que o custo num projeto
 * deste tamanho.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
});
