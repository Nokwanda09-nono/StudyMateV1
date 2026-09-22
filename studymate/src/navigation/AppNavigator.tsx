import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

// Auth Screens
import { VerifyEmailScreen } from "../screens/VerifyEmailScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";

// Main Screens
import { AIChatScreen } from "../screens/AIChatScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ModuleDetailScreen } from "../screens/ModuleDetailScreen";
import { ModulesScreen } from "../screens/ModulesScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PDFViewerScreen } from "../screens/PDFViewerScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { QuizScreen } from "../screens/QuizScreen";
import { ScheduleScreen } from "../screens/ScheduleScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
          />
        </>
      ) : !user.onboardingCompleted ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="AIChat" component={AIChatScreen} />
          <Stack.Screen name="Modules" component={ModulesScreen} />
          <Stack.Screen name="ModuleDetail" component={ModuleDetailScreen} />
          <Stack.Screen name="Quiz" component={QuizScreen} />
          <Stack.Screen name="Schedule" component={ScheduleScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="PDFViewer" component={PDFViewerScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
