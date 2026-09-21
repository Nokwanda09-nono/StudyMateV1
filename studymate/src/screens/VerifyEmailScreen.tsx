import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  Login: undefined;
  VerifyEmail: { email: string };
};

export function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VerifyEmail'>>();
  const { email } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Email not found. Please go back and register again.');
      return;
    }

    setResendLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          'Verification email has been resent. Please check your inbox.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#eef2ff', '#fae8ff']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail" size={60} color="#6366f1" />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to:
        </Text>
        <Text style={styles.email}>{email || 'your email address'}</Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color="#6366f1" />
          <Text style={styles.infoText}>
            Please check your email and click the verification link to activate your account.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendVerification}
          disabled={resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#6366f1" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={20} color="#6366f1" />
              <Text style={styles.resendText}>Resend Verification Email</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: '#4b5563',
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  resendText: {
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 8,
  },
  loginButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});