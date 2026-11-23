import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { FloatingField } from '../components/FloatingField';
import { LegalDocument } from '../components/LegalDocument';
import { LoadingScreen } from '../components/LoadingScreen';
import { PRIVACY_POLICY, TERMS_OF_USE } from '../content/legal';
import { useAuthStore } from '../context/useAuthStore';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { sendPasswordReset } from '../services/adminApi';
import { colors, font, spacing, typography } from '../theme';
import { dashboardPalette } from '../theme/dashboardPalette';
import { showAlert } from '../utils/alert';

type Mode = 'login' | 'signup';

const COPY: Record<
  Mode,
  { title: string; subtitle: string; cta: string; busy: string; switchText: string; switchAction: string }
> = {
  login: {
    title: 'Entrar',
    subtitle: 'Acompanhe pedidos, mesas e vendas em tempo real.',
    cta: 'Entrar',
    busy: 'Entrando…',
    switchText: 'Ainda não tem conta?',
    switchAction: 'Criar conta',
  },
  signup: {
    title: 'Criar conta',
    subtitle: 'Organize seu quiosque em poucos minutos.',
    cta: 'Criar conta',
    busy: 'Criando conta…',
    switchText: 'Já tem uma conta?',
    switchAction: 'Entrar',
  },
};

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>('login');
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null);
  const { contentStyle } = useResponsiveContent(440);

  // Telas baixas e o cadastro (4 campos) compactam o espaçamento para caber
  // sem rolagem antes do teclado abrir.
  const { height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 760 || mode === 'signup';
  const fieldGap = isCompact ? 10 : 12;

  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const modeFade = useRef(new Animated.Value(1)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [enter]);

  // Troca de modo: o conteúdo faz um fade rápido em vez de piscar.
  useEffect(() => {
    modeFade.setValue(0);
    Animated.timing(modeFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [mode, modeFade]);

  // Cobre o formulário com a tela de loading do app enquanto autentica
  // (mesma duração mínima da abertura, pra não piscar em logins rápidos).
  const showLoadingOverlay = useMinimumVisible(loading);
  useEffect(() => {
    Animated.timing(loadingOpacity, {
      toValue: showLoadingOverlay ? 1 : 0,
      duration: showLoadingOverlay ? 200 : 260,
      useNativeDriver: true,
    }).start();
  }, [showLoadingOverlay, loadingOpacity]);

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Preencha e-mail e senha.');
      runShake();
      return;
    }
    setLoading(true);
    const { ok, error: loginError } = await login(email, password);
    setLoading(false);
    if (!ok) {
      setError(loginError ?? 'E-mail ou senha inválidos.');
      runShake();
    }
  };

  // Sem isso, quem esquece a senha (ou é o único admin da organização) fica
  // sem nenhuma forma de recuperar a conta — o reset de senha por um outro
  // admin (ver UserManagementScreen) só existe pra quem já está logado.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Informe seu e-mail para recuperar a senha.');
      runShake();
      return;
    }
    setResettingPassword(true);
    try {
      await sendPasswordReset(email);
      showAlert('E-mail enviado', `Enviamos um link de redefinição de senha para ${email.trim()}.`);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível enviar o e-mail de redefinição.');
      runShake();
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!orgName.trim() || !displayName.trim() || !email.trim() || !password.trim()) {
      setError('Preencha todos os campos.');
      runShake();
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      runShake();
      return;
    }
    setLoading(true);
    const { ok, error: signUpError } = await signUp({
      orgName,
      displayName,
      email,
      password,
    });
    setLoading(false);
    if (!ok) {
      setError(signUpError ?? 'Não foi possível criar a conta.');
      runShake();
    }
  };

  const handleSubmit = mode === 'login' ? handleLogin : handleSignUp;

  const clearError = () => {
    if (error) setError('');
  };

  const copy = COPY[mode];
  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const formShake = { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FFFFFF', colors.background]}
        style={styles.topWash}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.main, enterStyle]}>
              <View style={styles.brandRow}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="cover"
                />
                <View>
                  <Text style={styles.brandName}>Mar Azul</Text>
                  <Text style={styles.brandTag}>Gestão do quiosque</Text>
                </View>
              </View>

              <Animated.View style={{ opacity: modeFade }}>
                <Text style={[styles.title, isCompact && styles.titleCompact]}>{copy.title}</Text>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>
              </Animated.View>

              <Animated.View style={[{ opacity: modeFade }, formShake]}>
                <View style={[styles.fields, { gap: fieldGap }]}>
                  {mode === 'signup' && (
                    <>
                      <FloatingField
                        label="Nome do quiosque"
                        icon="storefront-outline"
                        accent={dashboardPalette.brand}
                        compact={isCompact}
                        value={orgName}
                        onChangeText={(v) => {
                          setOrgName(v);
                          clearError();
                        }}
                        placeholder="Quiosque do Rodrigo"
                        returnKeyType="next"
                      />
                      <FloatingField
                        label="Seu nome"
                        icon="person-outline"
                        accent={dashboardPalette.brand}
                        compact={isCompact}
                        value={displayName}
                        onChangeText={(v) => {
                          setDisplayName(v);
                          clearError();
                        }}
                        placeholder="Seu nome completo"
                        returnKeyType="next"
                      />
                    </>
                  )}

                  <FloatingField
                    label="E-mail"
                    icon="mail-outline"
                    accent={dashboardPalette.brand}
                    compact={isCompact}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      clearError();
                    }}
                    placeholder="voce@quiosque.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                  />

                  <FloatingField
                    label="Senha"
                    icon="lock-closed-outline"
                    accent={dashboardPalette.brand}
                    compact={isCompact}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      clearError();
                    }}
                    placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="go"
                    accessory={
                      <Pressable
                        hitSlop={10}
                        onPress={() => setShowPassword((v) => !v)}
                        accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    }
                  />
                </View>

                {mode === 'login' && (
                  <Pressable
                    hitSlop={8}
                    onPress={handleForgotPassword}
                    disabled={resettingPassword}
                    style={styles.forgotPasswordWrap}
                  >
                    <Text style={styles.forgotPasswordText}>
                      {resettingPassword ? 'Enviando…' : 'Esqueceu a senha?'}
                    </Text>
                  </Pressable>
                )}

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <AnimatedPressable
                  style={[styles.cta, isCompact && styles.ctaCompact]}
                  stateLayerColor={colors.white}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <Text style={styles.ctaText}>{loading ? copy.busy : copy.cta}</Text>
                </AnimatedPressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>{copy.switchText}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  >
                    <Text style={styles.switchAction}>{copy.switchAction}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </Animated.View>

            <Text style={styles.legalText}>
              Ao continuar, você concorda com o{' '}
              <Text style={styles.legalLink} onPress={() => setLegalDoc('terms')}>
                Termo de Uso
              </Text>{' '}
              e a{' '}
              <Text style={styles.legalLink} onPress={() => setLegalDoc('privacy')}>
                Política de Privacidade
              </Text>
              .
            </Text>
          </ScrollView>

          <Modal
            visible={legalDoc !== null}
            animationType="slide"
            onRequestClose={() => setLegalDoc(null)}
          >
            <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right', 'bottom']}>
              <View style={styles.legalModalHeader}>
                <Text style={styles.legalModalTitle}>
                  {legalDoc === 'privacy' ? PRIVACY_POLICY.title : TERMS_OF_USE.title}
                </Text>
                <AnimatedPressable
                  onPress={() => setLegalDoc(null)}
                  style={styles.legalCloseBtn}
                  stateLayerColor={colors.onSurface}
                  accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </AnimatedPressable>
              </View>
              {legalDoc ? (
                <LegalDocument doc={legalDoc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE} />
              ) : null}
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Animated.View
        pointerEvents={showLoadingOverlay ? 'auto' : 'none'}
        style={[styles.loadingOverlay, { opacity: loadingOpacity }]}
      >
        <LoadingScreen message={mode === 'login' ? 'Entrando…' : 'Criando sua conta…'} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  topWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  main: { flex: 1, justifyContent: 'center', paddingBottom: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.xxl },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandName: { fontFamily: font.bold, fontSize: 17, letterSpacing: -0.4, color: colors.textPrimary },
  brandTag: { fontFamily: font.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  title: {
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -1.2,
    color: colors.textPrimary,
  },
  titleCompact: { fontSize: 28, letterSpacing: -1 },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 6,
  },
  fields: { marginTop: spacing.xl },
  forgotPasswordWrap: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotPasswordText: { fontFamily: font.semiBold, fontSize: 13, color: dashboardPalette.brand },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerMuted,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginTop: spacing.md,
  },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.danger, flexShrink: 1 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    marginTop: spacing.lg,
    backgroundColor: dashboardPalette.brand,
    overflow: 'hidden',
  },
  ctaCompact: { height: 50, marginTop: spacing.md },
  ctaText: { fontFamily: font.semiBold, fontSize: 16, letterSpacing: -0.2, color: colors.white },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  switchText: { fontFamily: font.regular, fontSize: 14, color: colors.textSecondary },
  switchAction: { fontFamily: font.semiBold, fontSize: 14, color: colors.textPrimary },
  legalText: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  legalLink: { fontFamily: font.semiBold, color: colors.textSecondary },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  legalModalTitle: { ...typography.h2, color: colors.textPrimary },
  legalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
