import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';

interface CustomCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export const CustomCard: React.FC<CustomCardProps> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={[styles.card, style]} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
