// src/components/ButtomNav.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Define the navigation param list
type RootStackParamList = {
  Home: undefined;
  Modules: undefined;
  Schedule: undefined;
  AIChat: undefined;
  Profile: undefined;
  ModuleDetail: { id: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define the nav item type
interface NavItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap; // This ensures valid icon names
  route: "Home" | "Modules" | "Schedule" | "AIChat" | "Profile";
}

const navItems: NavItem[] = [
  { name: "Home", icon: "home-outline", route: "Home" },
  { name: "Modules", icon: "grid-outline", route: "Modules" },
  { name: "Schedules", icon: "calendar-outline", route: "Schedule" },
  { name: "AI Chat", icon: "chatbubble-ellipses-outline", route: "AIChat" },
  { name: "Profile", icon: "person-outline", route: "Profile" },
];

export function BottomNav() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = route.name === item.route;
        return (
          <TouchableOpacity
            key={item.name}
            style={styles.navItem}
            onPress={() => navigation.navigate(item.route)}
          >
            <Ionicons
              name={item.icon as any} // Use 'as any' here
              size={24}
              color={isActive ? "#6366f1" : "#6b7280"}
            />
            <Text style={[styles.navText, isActive && styles.navTextActive]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
    justifyContent: "space-around",
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navText: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  navTextActive: {
    color: "#6366f1",
    fontWeight: "600",
  },
});
