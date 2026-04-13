import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import { notBundle } from 'vite-plugin-electron/plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'serve'
      ? [
          electron({
            main: {
              entry: 'electron/main.ts',
              vite: {
                plugins: [notBundle()],
                build: {
                  rollupOptions: {
                    external: ['pg'],
                  },
                },
              },
            },
            preload: {
              input: path.join(__dirname, 'electron/preload.ts'),
            },
            ...(process.env.NODE_ENV === 'test'
              ? {}
              : {
                  renderer: {},
                }),
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@shared': path.resolve(__dirname, './electron/shared'),
    },
  },
}))
