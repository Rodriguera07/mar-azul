import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';

interface Props {
  children: React.ReactNode;
  // "screen": uma tela quebrou, o resto do app continua usável (barra de abas,
  // menu). "app": falha na raiz — oferece recarregar o app inteiro.
  scope?: 'screen' | 'app';
}

interface State {
  error: Error | null;
}

// Sem um boundary, qualquer exceção durante a renderização (ex.: um dado do
// banco fora do formato esperado) desmonta a árvore React inteira e o usuário
// só vê uma tela em branco, sem saída. Com ele, o erro fica contido na tela
// afetada, com uma mensagem e um botão de "Tentar novamente".
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private retry = () => {
    if (this.props.scope === 'app' && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const isApp = this.props.scope === 'app';

    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <View style={styles.icon}>
          <Ionicons name="alert-circle-outline" size={28} color={dashboardPalette.rose} />
        </View>
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.text}>
          {isApp
            ? 'O aplicativo encontrou um problema inesperado. Tente recarregar.'
            : 'Esta tela encontrou um problema inesperado. Você pode tentar de novo ou voltar e abrir outra tela.'}
        </Text>
        <Pressable style={styles.button} onPress={this.retry} accessibilityRole="button">
          <Text style={styles.buttonText}>{isApp ? 'Recarregar' : 'Tentar novamente'}</Text>
        </Pressable>
        {/* Detalhe técnico, pequeno: com um print desta tela dá para descobrir o
            motivo mesmo em um celular que não dá para depurar. */}
        <Text style={styles.detail} selectable>
          {String(this.state.error?.message ?? this.state.error).slice(0, 200)}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${dashboardPalette.rose}14`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontFamily: font.bold, fontSize: 18, letterSpacing: -0.4, color: colors.textPrimary },
  text: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 290,
  },
  button: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: dashboardPalette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  detail: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 300,
  },
  buttonText: { fontFamily: font.semiBold, fontSize: 15, color: colors.white },
});
