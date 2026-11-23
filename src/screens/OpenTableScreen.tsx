import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { Button } from '../components/Button';
import { ScreenBar } from '../components/ScreenBar';
import { usePosStore } from '../context/usePosStore';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { RootStackParamList } from '../navigation/types';
import { colors, font, shape, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OpenTable'>;

const QUICK_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Balcão'];

function findDuplicateLabel(tables: { status: string; label: string }[], label: string) {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const match = tables.find(
    (t) => t.status === 'open' && t.label.trim().toLowerCase() === trimmed.toLowerCase()
  );
  return match ? trimmed : null;
}

export function OpenTableScreen({ navigation }: Props) {
  const openTable = usePosStore((s) => s.openTable);
  const tables = usePosStore((s) => s.tables);
  const [label, setLabel] = useState('');
  const [waiterName, setWaiterName] = useState('');
  const [error, setError] = useState('');
  const { contentStyle } = useResponsiveContent();

  // Avisa assim que o número digitado/selecionado bate com uma mesa já
  // aberta — antes de tocar em "Abrir Mesa", não só depois.
  const applyLabel = (value: string) => {
    setLabel(value);
    const duplicate = findDuplicateLabel(tables, value);
    setError(duplicate ? `A mesa "${duplicate}" já está aberta. Escolha outro número ou nome.` : '');
  };

  const handleConfirm = () => {
    if (!label.trim()) {
      setError('Informe o número ou nome da mesa.');
      return;
    }
    const duplicate = findDuplicateLabel(tables, label);
    if (duplicate) {
      setError(`A mesa "${duplicate}" já está aberta. Escolha outro número ou nome.`);
      return;
    }
    const id = openTable(label, waiterName);
    if (!id) return;
    navigation.replace('TableDetail', { tableId: id });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScreenBar
        title="Abrir Nova Mesa"
        onClose={() => navigation.goBack()}
      />

        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>Mesa / número</Text>
          <TextInput
            value={label}
            onChangeText={applyLabel}
            placeholder="Ex: Mesa 12"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, error && styles.inputError]}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.quickRow}>
            {QUICK_LABELS.map((q) => {
              const isDuplicate = findDuplicateLabel(tables, q) !== null;
              return (
                <AnimatedPressable
                  key={q}
                  style={[styles.chip, label === q && styles.chipActive, isDuplicate && styles.chipDuplicate]}
                  stateLayerColor={label === q ? colors.primary : colors.onSurface}
                  onPress={() => applyLabel(q)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      label === q && styles.chipTextActive,
                      isDuplicate && styles.chipTextDuplicate,
                    ]}
                  >
                    {q}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Garçom responsável (opcional)</Text>
          <TextInput
            value={waiterName}
            onChangeText={setWaiterName}
            placeholder="Ex: João"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </ScrollView>

        <View style={[styles.footer, contentStyle]}>
          <Button label="Abrir Mesa" size="lg" variant="primary" onPress={handleConfirm} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  fieldLabel: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 64,
    fontFamily: font.extraBold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerMuted,
    borderRadius: shape.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    minWidth: 64,
    height: 60,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.white,
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    shadowOpacity: 0,
    elevation: 0,
  },
  chipText: {
    fontFamily: font.extraBold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.white,
  },
  chipDuplicate: {
    borderColor: colors.danger,
    borderStyle: 'dashed',
  },
  chipTextDuplicate: {
    color: colors.danger,
  },
  error: {
    ...typography.bodySm,
    color: colors.danger,
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
