import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { CustomButton } from '../components/CustomButton';

type RootStackParamList = {
  Register: undefined;
  VerifyEmail: { email: string };
};

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // If login successful, navigation will be handled by auth context
    } catch (error: any) {
      // Check if the error is due to unverified email
      if (error.message?.includes('verify your email') || error.requiresVerification) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in. Would you like to resend the verification email?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Resend Email',
              onPress: () => handleResendVerification(),
            },
          ]
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    setResendLoading(true);
    try {
      await resendVerification(email);
      
      Alert.alert(
        'Verification Email Sent',
        'A new verification link has been sent to your email. Please check your inbox and spam folder.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('VerifyEmail', { email }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#eef2ff', '#fae8ff']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="school" size={40} color="white" />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login to continue your study journey</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.forgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <CustomButton
              title="Login"
              onPress={handleLogin}
              loading={loading}
              size="large"
              style={styles.loginButton}
            />

            {resendLoading && (
              <View style={styles.resendLoadingContainer}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.resendLoadingText}>Sending verification email...</Text>
              </View>
            )}

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity 
              style={styles.quickRegisterButton}
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
            >
              <Ionicons name="person-add-outline" size={20} color="#6366f1" />
              <Text style={styles.quickRegisterText}>Create New Account</Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Register')}
                disabled={loading}
              >
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#111827',
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  loginButton: {
    marginBottom: 12,
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9ca3af',
    fontSize: 14,
  },
  quickRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  quickRegisterText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 4,
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
});