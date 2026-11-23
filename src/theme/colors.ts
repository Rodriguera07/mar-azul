// Tema "delivery": base off-white quente, coral como cor de marca e amarelo-sol
// como acento (mesma linguagem da tela de login).
export const colors = {
  // Base — areia clara e neutra, tom exato do mock de referência do Dashboard
  background: '#FAF7F3',
  backgroundAlt: '#F3EDE6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#FFF3EC',
  border: '#EDE6DF',
  borderLight: '#E6DDD4',

  // Marca — mar / turquesa
  primary: '#F0432B', // teal do oceano — interativo geral
  primaryMuted: '#FDEBE6',
  primaryGlow: 'rgba(240, 67, 43, 0.16)',

  emerald: '#0EA98D', // turquesa vivo — faturamento / positivo / sucesso
  emeraldMuted: '#DFF5F0',
  emeraldGlow: 'rgba(14, 169, 141, 0.16)',

  coral: '#E2603D', // laranja de pôr do sol — atenção / destaque quente
  coralMuted: '#FCEAE3',
  coralGlow: 'rgba(226, 96, 61, 0.16)',

  sand: '#D98A00', // areia dourada — detalhes / dinheiro físico
  sandMuted: '#FFF1D6',
  sandGlow: 'rgba(217, 138, 0, 0.16)',

  // Semânticas
  success: '#0EA98D',
  danger: '#E1435C',
  dangerMuted: '#FCE7EA',
  warning: '#E2603D',
  warningMuted: '#FCEAE3',
  info: '#2A7DE1',

  // Texto
  textPrimary: '#1C0E09',
  textSecondary: '#7A6B62',
  textMuted: '#B3A69D',
  textInverse: '#FFFFFF',

  // Formas de pagamento (cores distintas para facilitar leitura em gráficos)
  pix: '#0EA98D',
  cash: '#4C9A2A',
  debit: '#1D6FD1',
  credit: '#E2603D',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 24, 28, 0.45)',

  // —— Papéis Material 3 (aliases sobre a paleta acima) ——
  // Mantém as cores da marca (praia/turquesa) mas nomeia os papéis do M3
  // (container/onContainer, superfícies em camadas, outline) para que os
  // componentes possam seguir o vocabulário do design system do Flutter.
  onPrimary: '#FFFFFF',
  primaryContainer: '#FDEBE6',
  onPrimaryContainer: '#5A1408',

  onSecondary: '#FFFFFF',
  secondaryContainer: '#DFF5F0',
  onSecondaryContainer: '#04503F',

  tertiary: '#D98A00',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFF1D6',
  onTertiaryContainer: '#5C3B0E',

  errorContainer: '#FCE7EA',
  onErrorContainer: '#6B1626',

  onSurface: '#1C0E09',
  onSurfaceVariant: '#7A6B62',
  outline: '#CFC3BA',
  outlineVariant: '#E6DDD4',

  // Superfícies em camadas: cada nível escurece um pouco a base quente — equivalente ao surface tint do M3, usado
  // para dar profundidade sem depender só de sombra.
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FCF9F6',
  surfaceContainer: '#F6F1EC',
  surfaceContainerHigh: '#F0E9E3',
  surfaceContainerHighest: '#EAE1DA',
} as const;

export type AppColors = typeof colors;
