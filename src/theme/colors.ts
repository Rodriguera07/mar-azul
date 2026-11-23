// Tema "Mar Azul": base azul-acinzentada bem clara, superfícies brancas com
// borda fina e azul-oceano como única cor de marca (ações e estados ativos).
// Laranja (coral/sand) e verde ficam para atenção e dinheiro.
export const colors = {
  // Base — areia clara e neutra, tom exato do mock de referência do Dashboard
  background: '#F3F6FB',
  backgroundAlt: '#EAF0F8',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#F8FAFD',
  border: '#E1E8F2',
  borderLight: '#EAF0F7',

  // Marca — azul-oceano (a cor do nome "Mar Azul")
  primary: '#1565D8', // interativo geral
  primaryMuted: '#E8F0FE',
  primaryGlow: 'rgba(21, 101, 216, 0.16)',

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
  info: '#1565D8',

  // Texto
  textPrimary: '#0F1B33',
  textSecondary: '#5B6B85',
  textMuted: '#97A3B8',
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
  primaryContainer: '#E8F0FE',
  onPrimaryContainer: '#0A2A6B',

  onSecondary: '#FFFFFF',
  secondaryContainer: '#DFF5F0',
  onSecondaryContainer: '#04503F',

  tertiary: '#D98A00',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFF1D6',
  onTertiaryContainer: '#5C3B0E',

  errorContainer: '#FCE7EA',
  onErrorContainer: '#6B1626',

  onSurface: '#0F1B33',
  onSurfaceVariant: '#5B6B85',
  outline: '#CAD4E3',
  outlineVariant: '#E1E8F2',

  // Superfícies em camadas: cada nível escurece um pouco a base quente — equivalente ao surface tint do M3, usado
  // para dar profundidade sem depender só de sombra.
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F8FAFD',
  surfaceContainer: '#F1F5FA',
  surfaceContainerHigh: '#E9EFF7',
  surfaceContainerHighest: '#E1E8F2',
} as const;

export type AppColors = typeof colors;
