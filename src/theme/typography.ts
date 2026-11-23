import { Platform, TextStyle } from 'react-native';

export const monoFontFamily = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
});

// Inter é a fonte padrão de todo o app (UI de produto: legível em números e
// tabelas). Cada peso é um arquivo estático separado — qualquer override
// pontual de ênfase precisa trocar `fontFamily` (font.x), não `fontWeight`.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

type TypeScale =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLg'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'label'
  | 'mono';

// Nunito é a fonte padrão de todo o app (mesma usada no Painel). Cada peso
// é um arquivo estático separado (ver font) — qualquer override
// pontual de ênfase precisa trocar `fontFamily`, não `fontWeight`.
export const typography: Record<TypeScale, TextStyle> = {
  display: { fontSize: 32, fontFamily: font.bold, letterSpacing: -0.9 },
  h1: { fontSize: 24, fontFamily: font.bold, letterSpacing: -0.6 },
  h2: { fontSize: 19, fontFamily: font.semiBold, letterSpacing: -0.4 },
  h3: { fontSize: 16, fontFamily: font.semiBold, letterSpacing: -0.2 },
  bodyLg: { fontSize: 15, fontFamily: font.medium, letterSpacing: -0.1 },
  body: { fontSize: 14, fontFamily: font.regular, letterSpacing: -0.1 },
  bodySm: { fontSize: 13, fontFamily: font.regular, letterSpacing: -0.05 },
  caption: { fontSize: 12, fontFamily: font.medium },
  label: { fontSize: 11, fontFamily: font.semiBold, letterSpacing: 0.4 },
  mono: { fontSize: 14, fontFamily: font.semiBold, letterSpacing: -0.2 },
};
