import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// O app instalado no celular (PWA) é uma aba "congelada": se fica aberto o dia
// todo ou volta do segundo plano, continua rodando o código de quando foi
// aberto — mesmo depois de uma versão nova ser publicada. Aqui comparamos o
// pacote JavaScript carregado agora com o que o servidor está entregando e
// avisamos (ou recarregamos) quando mudou.

const BUNDLE_PATTERN = /\/_expo\/static\/js\/web\/[^"'\s>]+\.js/;
const CHECK_EVERY_MS = 5 * 60 * 1000;
// Se o app ficou em segundo plano por mais que isso, é seguro recarregar na
// volta (ninguém estava digitando) — antes disso só mostramos o aviso.
const AUTO_RELOAD_AFTER_HIDDEN_MS = 60 * 1000;

function currentBundlePath(): string | null {
  if (typeof document === 'undefined') return null;
  const script = Array.from(document.scripts).find((s) => BUNDLE_PATTERN.test(s.src));
  if (!script) return null;
  const match = script.src.match(BUNDLE_PATTERN);
  return match ? match[0] : null;
}

// Identificador curto da versão carregada (parte do nome do pacote), para
// conferir de relance qual versão o celular está rodando.
export function getBuildId(): string | null {
  const path = currentBundlePath();
  const hash = path?.match(/index-([0-9a-f]{6,})/i)?.[1];
  return hash ? hash.slice(0, 7) : null;
}

export function applyUpdate() {
  if (typeof window !== 'undefined') window.location.reload();
}

export function useAppUpdate(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const loaded = currentBundlePath();
    // Em desenvolvimento (sem pacote versionado) não há o que comparar.
    if (!loaded) return;

    let cancelled = false;
    let hiddenAt: number | null = null;
    let found = false;

    const check = async () => {
      try {
        const res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const latest = html.match(BUNDLE_PATTERN)?.[0];
        if (!cancelled && latest && latest !== loaded) {
          found = true;
          setUpdateAvailable(true);
        }
      } catch {
        // Sem rede: tenta de novo na próxima checagem.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const wasAway = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (found && wasAway > AUTO_RELOAD_AFTER_HIDDEN_MS) {
        applyUpdate();
        return;
      }
      check().then(() => {
        if (found && wasAway > AUTO_RELOAD_AFTER_HIDDEN_MS) applyUpdate();
      });
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { updateAvailable };
}
