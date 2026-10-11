import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
/**
 * Zwei Build-Varianten:
 *
 * `npm run build`         -> dist/  (normale Web-Auslieferung, ES-Module)
 * `npm run build:offline` -> eine einzige HTML-Datei, die per Doppelklick
 *                            direkt aus dem Dateisystem geöffnet werden kann.
 *
 * Hintergrund: Browser blockieren bei `file://` das Nachladen von separaten
 * ES-Modul-Dateien (CORS). Deshalb wird für die Offline-Variante
 * JavaScript und CSS vollständig in das HTML eingebettet.
 */
const offline = process.env.BUILD_OFFLINE === '1';
export default defineConfig({
    plugins: [react(), ...(offline ? [viteSingleFile()] : [])],
    base: './',
    /**
     * Auflösungsreihenfolge der Dateiendungen.
     *
     * Neben den TypeScript-Quellen (`*.ts`/`*.tsx`) liegen teils noch ältere,
     * kompilierte `*.js`-Dateien im Quellbaum. Damit Importe ohne Endung stets die
     * aktuelle TypeScript-Quelle laden (und nie ein veraltetes `.js`), wird die
     * Reihenfolge hier fest vorgegeben: `.ts`/`.tsx` vor `.js`.
     */
    resolve: {
        extensions: ['.mjs', '.ts', '.tsx', '.mts', '.jsx', '.js', '.json'],
    },
    build: {
        outDir: offline ? 'offline' : 'dist',
        sourcemap: false,
        assetsInlineLimit: offline ? 100000000 : 4096,
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        // Zentrale Testfreigabe (u. a. IS_REACT_ACT_ENVIRONMENT für Reacts act).
        setupFiles: ['src/tests/setupTests.ts'],
        globals: false,
    },
});
