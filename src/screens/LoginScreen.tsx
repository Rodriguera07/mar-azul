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
import { LoginFoodMarquee } from '../components/LoginFoodMarquee';
import { PRIVACY_POLICY, TERMS_OF_USE } from '../content/legal';
import { useAuthStore } from '../context/useAuthStore';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { sendPasswordReset } from '../services/adminApi';
import { colors, font, spacing, typography } from '../theme';
import { showAlert } from '../utils/alert';

// Paleta "delivery": coral vivo + amarelo sol sobre tinta escura, com as
// fotos do cardápio ao fundo. O resto do app mantém o teal/areia padrão.
const UI = {
  ink: '#140A06',
  accent: '#F0432B',
  accentLight: '#FF7A45',
  accentDeep: '#D02E1B',
  sun: '#FFB020',
};

type Mode = 'login' | 'signup';

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busy: string; switchText: string; switchAction: string }> = {
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

  // Telas baixas e o cadastro (4 campos) comprimem o título e os campos para
  // caber sem rolagem antes do teclado abrir.
  const { height: windowHeight } = useWindowDimensions();
  const isShort = windowHeight < 760;
  const isCompact = isShort || mode === 'signup';
  const tile = isShort ? 64 : 84;
  const showHeadline = !(mode === 'signup' && isShort);
  const fieldGap = isCompact ? 10 : 12;

  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const modeFade = useRef(new Animated.Value(1)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [enter]);

  // Troca de modo: o conteúdo do cartão faz um fade rápido em vez de piscar.
  useEffect(() => {
    modeFade.setValue(0);
    Animated.timing(modeFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
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
  const headlineStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
  };
  const cardStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
    ],
  };

  return (
    <View style={styles.root}>
      <LoginFoodMarquee tile={tile} />
      <LinearGradient
        colors={['rgba(20,10,6,0.72)', 'rgba(20,10,6,0.82)', 'rgba(20,10,6,0.97)']}
        locations={[0, 0.45, 0.85]}
        style={StyleSheet.absoluteFillObject}
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
            <Animated.View style={[styles.top, headlineStyle]}>
              <View style={styles.brandRow}>
                <View style={styles.logoBadge}>
                  <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text style={styles.brandTiny}>TRAILER</Text>
                  <Text style={styles.brandBig}>MAR AZUL</Text>
                </View>
              </View>

              {showHeadline && (
                <Text style={[styles.headline, isShort && styles.headlineSmall]}>
                  Seu quiosque,{'\n'}
                  <Text style={styles.headlineAccent}>na palma da mão.</Text>
                </Text>
              )}
            </Animated.View>

            <Animated.View style={[styles.card, isCompact && styles.cardCompact, cardStyle]}>
              <Animated.View style={{ opacity: modeFade }}>
                <Text style={styles.title}>{copy.title}</Text>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>

                <View style={[styles.fields, { gap: fieldGap }]}>
                  {mode === 'signup' && (
                    <>
                      <FloatingField
                        label="Nome do quiosque"
                        icon="storefront-outline"
                        accent={UI.accent}
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
                        accent={UI.accent}
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
                    accent={UI.accent}
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
                    accent={UI.accent}
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
                  <LinearGradient
                    colors={[UI.accentLight, UI.accent, UI.accentDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.ctaText}>{loading ? copy.busy : copy.cta}</Text>
                  {!loading ? (
                    <View style={styles.ctaArrow}>
                      <Ionicons name="arrow-forward" size={18} color={UI.accent} />
                    </View>
                  ) : null}
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
  root: { flex: 1, backgroundColor: UI.ink },
  flex: { flex: 1 },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  loadingOverlay: { ...StyleSheet.absoluteFillObject },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  top: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  logoImage: { width: '100%', height: '100%' },
  brandTiny: { ...typography.label, color: UI.sun, letterSpacing: 3, fontSize: 10 },
  brandBig: { ...typography.display, fontSize: 20, color: colors.white, letterSpacing: 0.5 },
  headline: {
    fontFamily: font.extraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: colors.white,
  },
  headlineSmall: { fontSize: 30, lineHeight: 34 },
  headlineAccent: { color: UI.sun },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  cardCompact: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: {
    fontFamily: font.extraBold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fields: { marginTop: spacing.md },
  forgotPasswordWrap: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotPasswordText: {
    ...typography.bodySm,
    color: UI.accent,
    fontFamily: font.bold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerMuted,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
  },
  error: { ...typography.bodySm, color: colors.danger, flexShrink: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 999,
    marginTop: spacing.lg,
    overflow: 'hidden',
    shadowColor: UI.accentDeep,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaCompact: { height: 52, marginTop: spacing.md },
  ctaText: { ...typography.h3, fontFamily: font.extraBold, color: colors.white },
  ctaArrow: {
    position: 'absolute',
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  switchText: { ...typography.bodySm, color: colors.textSecondary },
  switchAction: { ...typography.bodySm, color: UI.accent, fontFamily: font.extraBold },
  legalText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  legalLink: { color: colors.white, fontFamily: font.bold },
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
