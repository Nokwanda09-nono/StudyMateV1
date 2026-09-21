import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { CustomCard } from "../components/CustomCard";
import { BottomNav } from "../components/ButtomNav";
import { LinearGradient } from "expo-linear-gradient";

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { modules, schedule, assessments } = useStore();

  const getUsername = () => {
    if (user?.email) {
      const parts = user.email.split("@");
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return "Scholar";
  };

  // Stats calculations
  const todayOfWeek = new Date().getDay();
  const todayClasses = schedule.filter((s) => s.dayOfWeek === todayOfWeek);
  
  const completedAssessments = assessments.filter((a) => a.completed);
  const averageScore =
    completedAssessments.length > 0
      ? Math.round(
          completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) /
            completedAssessments.length
        )
      : 0;

  // Format today's date
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "short",
      day: "numeric",
    };
    return new Date().toLocaleDateString(undefined, options);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <LinearGradient
          colors={["#6366f1", "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeCard}
        >
          <View style={styles.welcomeHeader}>
            <View style={styles.welcomeInfo}>
              <Text style={styles.dateText}>{formatDate()}</Text>
              <Text style={styles.greetingText}>
                Hello, {getUsername()}!
              </Text>
              <Text style={styles.motivationalText}>
                {"\"Success is the sum of small efforts, repeated day in and day out.\""}
              </Text>
            </View>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={54} color="white" />
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <CustomCard style={styles.statCard}>
            <View style={[styles.statIconWrapper, { backgroundColor: "#e0e7ff" }]}>
              <Ionicons name="folder-open" size={22} color="#6366f1" />
            </View>
            <Text style={styles.statNumber}>{modules.length}</Text>
            <Text style={styles.statLabel}>Modules</Text>
          </CustomCard>

          <CustomCard style={styles.statCard}>
            <View style={[styles.statIconWrapper, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="calendar" size={22} color="#22c55e" />
            </View>
            <Text style={styles.statNumber}>{todayClasses.length}</Text>
            <Text style={styles.statLabel}>{"Today's Classes"}</Text>
          </CustomCard>

          <CustomCard style={styles.statCard}>
            <View style={[styles.statIconWrapper, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="trophy" size={22} color="#d97706" />
            </View>
            <Text style={styles.statNumber}>{averageScore}%</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </CustomCard>
        </View>

        {/* Today's Schedule Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{"Today's Classes"}</Text>
          <TouchableOpacity onPress={() => (navigation.navigate as any)("Schedule")}>
            <Text style={styles.seeAllText}>See Timetable</Text>
          </TouchableOpacity>
        </View>

        {todayClasses.length === 0 ? (
          <CustomCard style={styles.emptyScheduleCard}>
            <Ionicons name="sparkles-outline" size={36} color="#9ca3af" />
            <Text style={styles.emptyScheduleText}>
              No classes scheduled for today! Time for self-study.
            </Text>
          </CustomCard>
        ) : (
          <View style={styles.classesList}>
            {todayClasses.map((item) => (
              <CustomCard key={item.id} style={styles.classCard}>
                <View style={[styles.classColorTag, { backgroundColor: item.color || "#6366f1" }]} />
                <View style={styles.classCardBody}>
                  <Text style={styles.classTitle}>{item.title}</Text>
                  <View style={styles.classTimeRow}>
                    <Ionicons name="time-outline" size={14} color="#6b7280" />
                    <Text style={styles.classTimeText}>
                      {item.startTime} - {item.endTime}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </CustomCard>
            ))}
          </View>
        )}

        {/* Quick Access Actions */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => (navigation.navigate as any)("AIChat")}
          >
            <LinearGradient
              colors={["#f0fdf4", "#dcfce7"]}
              style={styles.actionBackground}
            >
              <Ionicons name="chatbubble-ellipses" size={28} color="#16a34a" />
              <Text style={styles.actionText}>AI Chat Buddy</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => (navigation.navigate as any)("Modules")}
          >
            <LinearGradient
              colors={["#eef2ff", "#e0e7ff"]}
              style={styles.actionBackground}
            >
              <Ionicons name="book" size={28} color="#4f46e5" />
              <Text style={styles.actionText}>Study Modules</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => (navigation.navigate as any)("Schedule")}
          >
            <LinearGradient
              colors={["#faf5ff", "#f3e8ff"]}
              style={styles.actionBackground}
            >
              <Ionicons name="time" size={28} color="#9333ea" />
              <Text style={styles.actionText}>Check Timetable</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => {
              // Navigate to schedule, and let it know we want assessments tab (optional state but navigates)
              (navigation.navigate as any)("Schedule");
            }}
          >
            <LinearGradient
              colors={["#fff7ed", "#ffedd5"]}
              style={styles.actionBackground}
            >
              <Ionicons name="sparkles" size={28} color="#ea580c" />
              <Text style={styles.actionText}>Take Assessments</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    padding: 20,
    paddingBottom: 90,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeInfo: {
    flex: 1,
    paddingRight: 10,
  },
  dateText: {
    color: "#e0e7ff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  greetingText: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  motivationalText: {
    color: "#f3f4f6",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
  },
  avatarContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: "600",
  },
  emptyScheduleCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyScheduleText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },
  classesList: {
    gap: 12,
  },
  classCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  classColorTag: {
    width: 6,
    height: "100%",
    borderRadius: 3,
    minHeight: 40,
  },
  classCardBody: {
    flex: 1,
    paddingHorizontal: 12,
    gap: 4,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  classTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  classTimeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionItem: {
    width: "48%",
    aspectRatio: 1.3,
  },
  actionBackground: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
});
