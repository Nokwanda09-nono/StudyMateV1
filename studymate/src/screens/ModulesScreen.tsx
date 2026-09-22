import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/ButtomNav";
import { CustomCard } from "../components/CustomCard";
import { CustomButton } from "../components/CustomButton";
import { AnimatedModal } from "../components/AnimatedModal";
import { useStore } from "../context/StoreContext";

// Define your navigation param list
type RootStackParamList = {
  Home: undefined;
  Modules: undefined;
  ModuleDetail: { id: string };
  Schedule: undefined;
  AIChat: undefined;
  Profile: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define the module type
interface Module {
  id: string;
  name: string;
  color?: string;
  fileCount?: number;
}

const MODULE_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#6366f1', '#f97316',
];

export function ModulesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { modules, addModule } = useStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [selectedColor, setSelectedColor] = useState(MODULE_COLORS[0]);

  const handleCreateModule = () => {
    if (!newModuleName.trim()) {
      Alert.alert("Error", "Please enter a module name");
      return;
    }

    const module = {
      id: Date.now().toString(),
      name: newModuleName,
      color: selectedColor,
      icon: "book",
      fileCount: 0,
    };

    addModule(module);
    setNewModuleName("");
    setSelectedColor(MODULE_COLORS[0]);
    setModalVisible(false);
  };

  const renderModule = ({ item }: { item: Module }) => (
    <CustomCard
      key={item.id}
      style={styles.moduleCard}
      onPress={() => navigation.navigate("ModuleDetail", { id: item.id })}
    >
      <View
        style={[
          styles.moduleIcon,
          { backgroundColor: item.color || "#6366f1" },
        ]}
      >
        <Ionicons name="book" size={28} color="white" />
      </View>
      <Text style={styles.moduleName} numberOfLines={2}>
        {item.name}
      </Text>
      <View style={styles.moduleStats}>
        <Ionicons name="document-text-outline" size={14} color="#6b7280" />
        <Text style={styles.moduleFileCount}>{item.fileCount || 0} files</Text>
      </View>
    </CustomCard>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>{"Let's Study"}</Text>
          <Text style={styles.subtitle}>
            {"Organize your study materials by module"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="#6366f1" />
          <Text style={styles.createButtonText}>{"Create New Module"}</Text>
        </TouchableOpacity>

        {modules.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
            </View>
            <Text style={styles.emptyStateTitle}>{"No modules yet"}</Text>
            <Text style={styles.emptyStateText}>
              {
                "Create your first module to start\norganizing your study materials"
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={modules}
            renderItem={renderModule}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.modulesGrid}
            contentContainerStyle={styles.modulesList}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      <AnimatedModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Create New Module"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Module Name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g., Project Management"
            value={newModuleName}
            onChangeText={setNewModuleName}
          />

          <Text style={styles.modalLabel}>Choose Color</Text>
          <View style={styles.colorGrid}>
            {MODULE_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>

          <CustomButton title="Create Module" onPress={handleCreateModule} />
        </View>
      </AnimatedModal>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "400",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366f1",
    marginLeft: 8,
  },
  modulesList: {
    paddingHorizontal: 16,
  },
  modulesGrid: {
    justifyContent: "space-between",
  },
  moduleCard: {
    width: "48%",
    marginBottom: 16,
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  moduleStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  moduleFileCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  modalContent: {
    gap: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "#9ca3af",
  },
});
