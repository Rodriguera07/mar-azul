import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props {
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

// Mesa que existia ao abrir a tela mas sumiu (fechada ou apagada em outro
// aparelho, ou link antigo). Antes, a tela ficava em branco (ou só com um
// aviso, sem saída); agora explica o que houve e oferece um botão de voltar.
export function MissingTable({
  onBack,
  title = 'Mesa não encontrada',
  subtitle = 'Esta mesa pode ter sido fechada ou removida em outro aparelho.',
}: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title={title}
          subtitle={subtitle}
        />
      </View>
      <View style={styles.footer}>
        <Button label="Voltar" variant="primary" size="lg" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center' },
  footer: { padding: spacing.lg },
});
