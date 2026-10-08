import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { colors, ui } from '../theme/theme';

export default function TextField({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} placeholderTextColor={colors.muted} selectionColor={colors.green}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[ui.input, style, focused && { borderColor: colors.green, backgroundColor: '#F6FBE9', boxShadow: `2px 2px 0px ${colors.green}` }, props.editable === false && { opacity: 0.6 }]} />;
}
