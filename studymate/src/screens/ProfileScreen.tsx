import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { CustomCard } from '../components/CustomCard';
import { CustomButton } from '../components/CustomButton';
import { BottomNav } from '../components/ButtomNav';

export function ProfileScreen() {
  const { logout, user: authUser } = useAuth();
  const { modules, assessments, profile } = useStore();

  const getModuleReport = (moduleId: string) => {
    const moduleAssessments = assessments.filter(a => a.moduleId === moduleId);
    const completedAssessments = moduleAssessments.filter(a => a.completed);
    const averageScore = completedAssessments.length > 0
      ? Math.round(completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / completedAssessments.length)
      : 0;

    return {
      averageScore,
      completedAssessments: completedAssessments.length,
      totalAssessments: moduleAssessments.length,
    };
  };

  const academicLevelMap: Record<string, string> = {
    'high-school': 'High School',
    'undergraduate': 'Undergraduate',
    'graduate': 'Graduate',
    'phd': 'PhD',
  };

  const studyStyleMap: Record<string, string> = {
    visual: 'Visual Learner',
    auditory: 'Auditory Learner',
    reading: 'Reading/Writing Learner',
    kinesthetic: 'Kinesthetic Learner',
  };

  const academicGoalMap: Record<string, string> = {
    graduate: 'Graduate with Honors',
    master: 'Master the Subject',
    pass: 'Pass the Course',
    exam: 'Prepare for Exams',
    improve: 'Improve Grades',
  };

  const fieldOfStudyMap: Record<string, string> = {
    'computer-science': 'Computer Science',
    engineering: 'Engineering',
    business: 'Business',
    medicine: 'Medicine',
    law: 'Law',
    arts: 'Arts & Humanities',
    sciences: 'Natural Sciences',
    'social-sciences': 'Social Sciences',
    other: 'Other',
  };

  const preferredStudyTimeMap: Record<string, string> = {
    morning: 'Morning (6 AM - 12 PM)',
    afternoon: 'Afternoon (12 PM - 6 PM)',
    evening: 'Evening (6 PM - 10 PM)',
    night: 'Night (10 PM - 2 AM)',
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all data and logout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Info */}
        <CustomCard style={styles.accountCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={40} color="white" />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountTitle}>Account Information</Text>
            <Text style={styles.accountEmail}>{authUser?.email}</Text>
          </View>
        </CustomCard>

        {/* Academic Profile */}
        <CustomCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Academic Profile</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="school-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Academic Level</Text>
                <Text style={styles.infoValue}>
                  {academicLevelMap[profile?.academicLevel || ''] || 'Not set'}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="book-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Field of Study</Text>
                <Text style={styles.infoValue}>
                  {fieldOfStudyMap[profile?.fieldOfStudy || ''] || 'Not set'}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="flag-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Academic Goal</Text>
                <Text style={styles.infoValue}>
                  {academicGoalMap[profile?.academicGoal || ''] || 'Not set'}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="bulb-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Study Style</Text>
                <Text style={styles.infoValue}>
                  {studyStyleMap[profile?.studyStyle || ''] || 'Not set'}
                </Text>
              </View>
            </View>
          </View>
        </CustomCard>

        {/* Study Schedule */}
        <CustomCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Study Schedule</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Study Hours per Day</Text>
                <Text style={styles.infoValue}>{profile?.studyHoursPerDay || 0} hours</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Study Days per Week</Text>
                <Text style={styles.infoValue}>{profile?.studyDaysPerWeek || 0} days</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="moon-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Preferred Study Time</Text>
                <Text style={styles.infoValue}>
                  {preferredStudyTimeMap[profile?.preferredStudyTime || ''] || 'Not set'}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="folder-outline" size={20} color="#8b5cf6" />
              <View>
                <Text style={styles.infoLabel}>Active Modules</Text>
                <Text style={styles.infoValue}>{modules.length} modules</Text>
              </View>
            </View>
          </View>
        </CustomCard>

        {/* Module Progress */}
        <CustomCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Module Progress</Text>
          {modules.length === 0 ? (
            <Text style={styles.noModulesText}>No modules yet.</Text>
          ) : (
            <View style={styles.modulesList}>
              {modules.map(module => {
                const report = getModuleReport(module.id);
                return (
                  <View key={module.id} style={styles.moduleProgressItem}>
                    <View style={styles.moduleProgressHeader}>
                      <View style={[styles.moduleColorDot, { backgroundColor: module.color }]} />
                      <Text style={styles.moduleProgressName}>{module.name}</Text>
                    </View>
                    <View style={styles.progressStats}>
                      <View style={styles.progressStat}>
                        <Ionicons name="checkbox-outline" size={16} color="#22c55e" />
                        <Text style={styles.progressStatText}>
                          Avg Score: {report.averageScore}%
                        </Text>
                      </View>
                      <View style={styles.progressStat}>
                        <Ionicons name="document-text-outline" size={16} color="#6366f1" />
                        <Text style={styles.progressStatText}>
                          {report.completedAssessments}/{report.totalAssessments} assessments
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </CustomCard>

        {/* Settings */}
        <CustomCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <CustomButton
            title="Clear All Data & Logout"
            variant="danger"
            onPress={handleClearData}
          />
        </CustomCard>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accountEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionCard: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  noModulesText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modulesList: {
    gap: 16,
  },
  moduleProgressItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
  },
  moduleProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  moduleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  moduleProgressName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  progressStats: {
    flexDirection: 'row',
    gap: 16,
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressStatText: {
    fontSize: 12,
    color: '#6b7280',
  },
});