import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/context/AuthContext";
import { StoreProvider } from "./src/context/StoreContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
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
