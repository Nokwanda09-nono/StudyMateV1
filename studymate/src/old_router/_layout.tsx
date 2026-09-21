import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/AuthContext";
import { StoreProvider } from "../context/StoreContext";
import { AppNavigator } from "../navigation/AppNavigator";

export default function RootLayout() {
  console.log("MY LAYOUT IS RUNNING");
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
