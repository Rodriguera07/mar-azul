import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevationShadow, font, shape, spacing, typography } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { LegalDoc } from '../content/legal';

interface Props {
  doc: LegalDoc;
  contentStyle?: object;
}

export function LegalDocument({ doc, contentStyle }: Props) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.updatedAt}>Atualizado em {doc.updatedAt}</Text>
      <Text style={styles.intro}>{doc.intro}</Text>

      <View style={styles.card}>
        {doc.sections.map((section, index) => (
          <View
            key={section.title}
            style={[styles.section, index === doc.sections.length - 1 && { marginBottom: 0 }]}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  updatedAt: {
    alignSelf: 'flex-start',
    fontFamily: font.bold,
    fontSize: 11.5,
    color: dashboardPalette.brand,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: shape.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: spacing.lg,
    shadowColor: '#2B1A12',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: font.extraBold,
    fontSize: 16,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sectionBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
