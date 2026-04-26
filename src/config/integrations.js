import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

function startupLogger() {
  return {
    name: 'tgp-startup-logger',
    hooks: {
      'astro:server:start': ({ address }) => {
        // Un ligero retraso para asegurar que se imprime después del output por defecto de Astro
        setTimeout(() => {
          const host = (address.address === '127.0.0.1' || address.address === '::1' || address.address === '0.0.0.0') 
            ? 'localhost' 
            : address.address;
          const baseUrl = `http://${host}:${address.port}`;
          
          console.log(`\n  \x1b[42m\x1b[30m TGP APP \x1b[0m \x1b[32mLocal dev:\x1b[0m    \x1b[4m${baseUrl}/\x1b[0m`);
          console.log(`  \x1b[45m\x1b[30m ADMIN   \x1b[0m \x1b[35mKeystatic:\x1b[0m    \x1b[4m${baseUrl}/keystatic\x1b[0m\n`);
        }, 100);
      }
    }
  };
}

export const tgpIntegrations = [
  react(), 
  markdoc(), 
  keystatic(),
  startupLogger()
];

export const tgpViteConfig = {
  plugins: [tailwindcss()]
};
