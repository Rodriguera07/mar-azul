import { Platform } from 'react-native';

// iPhone/iPad no navegador ou no app instalado (todos rodam sobre o WebKit).
// iPadOS se apresenta como Mac, por isso a checagem extra de toque.
export const isAppleMobileWeb: boolean =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1));
