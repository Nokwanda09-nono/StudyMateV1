import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Text, Linking, Platform } from 'react-native';
import React, { type ComponentProps } from 'react';

type Props = ComponentProps<typeof Text> & { href: string };

export function ExternalLink({ href, children, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[{ color: '#007AFF' }, style]}
      onPress={async () => {
        if (Platform.OS !== 'web') {
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        } else {
          Linking.openURL(href);
        }
      }}
    >
      {children}
    </Text>
  );
}
