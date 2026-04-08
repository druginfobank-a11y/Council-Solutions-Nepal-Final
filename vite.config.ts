import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, '.', '') };
    const apiKey = env.GEMINI_API_KEY || env.API_KEY || env.VITE_GEMINI_API_KEY || "";
    const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || "";
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.GROQ_API_KEY': JSON.stringify(groqKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
