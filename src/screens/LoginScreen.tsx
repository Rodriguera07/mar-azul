import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { LegalDocument } from '../components/LegalDocument';
import { LoadingScreen } from '../components/LoadingScreen';
import { LoginFoodMarquee } from '../components/LoginFoodMarquee';
import { PRIVACY_POLICY, TERMS_OF_USE } from '../content/legal';
import { useAuthStore } from '../context/useAuthStore';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { useResponsiveContent } from '../hooks/useResponsiveContent';
import { sendPasswordReset } from '../services/adminApi';
import { colors, nunitoFontFamily, shape, spacing, typography } from '../theme';
import { showAlert } from '../utils/alert';

// Paleta "delivery" desta tela: coral vivo + amarelo sol sobre tinta escura
// (fotos de comida ao fundo). O resto do app mantém o teal/areia padrão.
const HERO = {
  shadowColor: '#2B0A04',
  ink: '#1C0E09',
  sea: '#F0432B', // cor de ação (foco, links, ícones ativos)
  seaDeep: '#C92A18',
  sun: '#FFB020',
  bronzeLight: '#FF7A45', // gradiente do botão principal
  bronze: '#F0432B',
  bronzeDeep: '#D02E1B',
  tabTrack: '#F1ECE8',
  fieldBg: '#F6F3F0',
};

const WELCOME_COPY: Record<Mode, { title: string; subtitle: string }> = {
  login: {
    title: 'Bem-vindo de volta',
    subtitle: 'Entre para acompanhar pedidos, mesas e vendas em tempo real.',
  },
  signup: {
    title: 'Vamos começar',
    subtitle: 'Crie sua conta e organize seu quiosque em poucos minutos.',
  },
};

type Mode = 'login' | 'signup';

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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null);
  const { contentStyle } = useResponsiveContent(440);

  // Cadastro tem mais campos que login (nome do quiosque + nome do
  // responsável), então precisa de mais espaço vertical — a ilustração e os
  // selos decorativos cedem lugar ao formulário antes, e mais cedo, do que no
  // login. Em telas baixas (celulares menores), ambos os modos comprimem
  // ainda mais para caber sem rolagem antes do teclado abrir.
  const { height: windowHeight } = useWindowDimensions();
  const isShort = windowHeight < 900;
  const isCompact = isShort || mode === 'signup';
  // Cadastro + tela baixa é a combinação mais apertada (4 campos + selo) —
  // encolhe o selo ainda mais só nesse caso pra sobrar espaço pro formulário.
  const tile = isShort ? 58 : 76;
  const heroHeight = mode === 'signup' && isShort ? 170 : isShort ? 215 : isCompact ? 250 : 320;
  const showIntro = !(mode === 'signup' && isShort);
  const fieldGapStyle = { marginTop: isCompact ? spacing.xs : spacing.md };

  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const heroFloat = useRef(new Animated.Value(0)).current;
  const introFade = useRef(new Animated.Value(0)).current;
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // Logo flutua suavemente sem parar — dá vida à tela sem disputar atenção
  // com o formulário.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heroFloat]);

  // Saudação e indicador da aba reagem à troca de modo (login/cadastro) com
  // um leve fade e um pill que desliza, em vez de trocar de estado seco.
  useEffect(() => {
    introFade.setValue(0);
    Animated.timing(introFade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [mode, introFade]);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: mode === 'login' ? 0 : 1,
      useNativeDriver: false,
      speed: 16,
      bounciness: 8,
    }).start();
  }, [mode, indicatorAnim]);

  // Cobre o formulário com a mesma cena "mar ao amanhecer" da abertura do
  // app enquanto autentica, em vez do usuário ver só o texto do botão mudar
  // e depois um corte seco pro painel quando a sessão autentica. Sustenta a
  // mesma duração mínima do loading de abertura do app, pra não piscar em
  // logins muito rápidos.
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

  const brandStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
    ],
  };
  const sheetStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
    ],
  };
  const heroFloatY = heroFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const indicatorLeft = indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });
  const welcome = WELCOME_COPY[mode];

  return (
    <View style={styles.flex}>
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
            <View style={[styles.hero, { height: heroHeight }]}>
              <LoginFoodMarquee tile={tile} />
              <LinearGradient
                colors={['rgba(28,14,9,0.15)', 'rgba(28,14,9,0.55)', 'rgba(28,14,9,0.96)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              <Animated.View style={[styles.brandWrap, brandStyle]}>
                <Animated.View style={[styles.logoBadge, { transform: [{ translateY: heroFloatY }] }]}>
                  <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                </Animated.View>
                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandTiny}>TRAILER</Text>
                  <Text style={styles.brandBig}>MAR AZUL</Text>
                </View>
              </Animated.View>
            </View>

            <Animated.View style={sheetStyle}>
              <View style={[styles.sheet, isCompact && styles.sheetCompact]}>
                <Animated.View style={{ opacity: introFade }}>
                  <Text style={styles.title}>{welcome.title}</Text>
                  {showIntro && <Text style={styles.subtitle}>{welcome.subtitle}</Text>}
                </Animated.View>

                <View style={[styles.modeSwitch, isCompact && styles.modeSwitchCompact]}>
                  <Animated.View style={[styles.modeIndicator, { left: indicatorLeft }]} />
                  <AnimatedPressable
                    style={styles.modeTab}
                    stateLayerColor={colors.onSurface}
                    onPress={() => switchMode('login')}
                  >
                    <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
                      Entrar
                    </Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={styles.modeTab}
                    stateLayerColor={colors.onSurface}
                    onPress={() => switchMode('signup')}
                  >
                    <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                      Criar conta
                    </Text>
                  </AnimatedPressable>
                </View>

                {mode === 'signup' && (
                  <>
                    <Text style={styles.fieldLabel}>Nome do quiosque</Text>
                    <View
                      style={[
                        styles.inputWrap,
                        isCompact && styles.inputWrapCompact,
                        focusedField === 'org' && styles.inputWrapFocused,
                      ]}
                    >
                      <Ionicons
                        name="storefront-outline"
                        size={19}
                        color={focusedField === 'org' ? HERO.sea : colors.textMuted}
                      />
                      <TextInput
                        value={orgName}
                        onChangeText={(v) => {
                          setOrgName(v);
                          if (error) setError('');
                        }}
                        onFocus={() => setFocusedField('org')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Quiosque do Rodrigo"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        returnKeyType="next"
                      />
                    </View>

                    <Text style={[styles.fieldLabel, fieldGapStyle]}>Seu nome</Text>
                    <View
                      style={[
                        styles.inputWrap,
                        isCompact && styles.inputWrapCompact,
                        focusedField === 'name' && styles.inputWrapFocused,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={19}
                        color={focusedField === 'name' ? HERO.sea : colors.textMuted}
                      />
                      <TextInput
                        value={displayName}
                        onChangeText={(v) => {
                          setDisplayName(v);
                          if (error) setError('');
                        }}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Seu nome completo"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        returnKeyType="next"
                      />
                    </View>
                  </>
                )}

                <Text style={[styles.fieldLabel, mode === 'signup' && fieldGapStyle]}>E-mail</Text>
                <View
                  style={[
                    styles.inputWrap,
                    isCompact && styles.inputWrapCompact,
                    focusedField === 'user' && styles.inputWrapFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={focusedField === 'user' ? HERO.sea : colors.textMuted}
                  />
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (error) setError('');
                    }}
                    onFocus={() => setFocusedField('user')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="voce@quiosque.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                    returnKeyType="next"
                  />
                </View>

                <Text style={[styles.fieldLabel, fieldGapStyle]}>Senha</Text>
                <View
                  style={[
                    styles.inputWrap,
                    isCompact && styles.inputWrapCompact,
                    focusedField === 'pass' && styles.inputWrapFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={focusedField === 'pass' ? HERO.sea : colors.textMuted}
                  />
                  <TextInput
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (error) setError('');
                    }}
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="go"
                  />
                  <Pressable
                    hitSlop={10}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={colors.textSecondary}
                    />
                  </Pressable>
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
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <AnimatedPressable
                  style={[styles.enterBtn, isCompact && styles.enterBtnCompact]}
                  stateLayerColor={colors.white}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[HERO.bronzeLight, HERO.bronze, HERO.bronzeDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.enterBtnText}>
                    {loading
                      ? mode === 'login'
                        ? 'Entrando…'
                        : 'Criando conta…'
                      : mode === 'login'
                        ? 'Entrar'
                        : 'Criar conta'}
                  </Text>
                  {!loading ? (
                    <Ionicons name="arrow-forward" size={19} color={colors.textInverse} />
                  ) : null}
                </AnimatedPressable>

                <Text style={[styles.legalText, isCompact && styles.legalTextCompact]}>
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
              </View>
            </Animated.View>
          </ScrollView>

          <Modal
            visible={legalDoc !== null}
            animationType="slide"
            onRequestClose={() => setLegalDoc(null)}
          >
            <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
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
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl + 14,
    backgroundColor: HERO.ink,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTiny: {
    ...typography.label,
    color: HERO.sun,
    letterSpacing: 3,
    fontSize: 10,
  },
  brandBig: {
    ...typography.display,
    fontSize: 24,
    color: colors.white,
    letterSpacing: 0.5,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  sheetCompact: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  modeSwitch: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: HERO.tabTrack,
    borderRadius: shape.full,
    padding: 4,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modeSwitchCompact: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    borderRadius: shape.full,
    backgroundColor: '#FFFFFF',
    shadowColor: '#2C2419',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: shape.full,
    overflow: 'hidden',
    alignItems: 'center',
  },
  modeTabText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.textPrimary,
    fontFamily: nunitoFontFamily.extraBold,
  },
  title: {
    ...typography.h1,
    fontSize: 26,
    fontFamily: nunitoFontFamily.extraBold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  fieldLabel: {
    ...typography.bodySm,
    fontFamily: nunitoFontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HERO.fieldBg,
    borderRadius: shape.large,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    height: 54,
    gap: spacing.sm,
  },
  inputWrapCompact: {
    height: 48,
  },
  inputWrapFocused: {
    borderColor: HERO.sea,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.textPrimary,
    height: '100%',
  },
  forgotPasswordWrap: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  forgotPasswordText: {
    ...typography.bodySm,
    color: HERO.sea,
    fontFamily: nunitoFontFamily.bold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerMuted,
    borderRadius: shape.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  error: {
    ...typography.bodySm,
    color: colors.danger,
    flexShrink: 1,
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: shape.large,
    height: 56,
    marginTop: spacing.xl,
    overflow: 'hidden',
    shadowColor: HERO.bronzeDeep,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  enterBtnCompact: {
    height: 50,
    marginTop: spacing.md,
  },
  enterBtnText: {
    ...typography.h3,
    color: colors.textInverse,
  },
  legalText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: spacing.md,
  },
  legalTextCompact: {
    marginTop: spacing.xs,
  },
  legalLink: {
    color: HERO.sea,
    fontFamily: nunitoFontFamily.bold,
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  legalModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  legalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
