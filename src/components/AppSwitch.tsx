import React from 'react';
import { Switch, SwitchProps } from 'react-native';
import { colors } from '../theme';

// Interruptor com as cores da marca. Na web, o react-native-web pinta o botão
// "ligado" com `activeThumbColor` (e ignora `thumbColor` nesse estado), então
// as duas propriedades são passadas para ficar igual em todas as plataformas.
export function AppSwitch({ value, ...rest }: SwitchProps) {
  const webProps = { activeThumbColor: colors.primary } as object;
  return (
    <Switch
      value={value}
      trackColor={{ false: colors.surfaceContainerHigh, true: `${colors.primary}55` }}
      thumbColor={value ? colors.primary : colors.textMuted}
      {...webProps}
      {...rest}
    />
  );
}
