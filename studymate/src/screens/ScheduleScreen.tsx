import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../context/StoreContext';
import { CustomCard } from '../components/CustomCard';
import { CustomButton } from '../components/CustomButton';
import { AnimatedModal } from '../components/AnimatedModal';
import { BottomNav } from '../components/ButtomNav';
import { Assessment } from '../lib/store';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];

export function ScheduleScreen() {
  const navigation = useNavigation();
  const {
    modules,
    schedule,
    attendance,
    assessments,
    addScheduleItem,
    deleteScheduleItem,
    addAttendance,
    addAssessment,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'timetable' | 'assessments'>('timetable');

  // Timetable States
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);
  const [newTimetableItem, setNewTimetableItem] = useState({
    title: '',
    moduleId: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
  });

  // Assessment States
  const [assessmentModalVisible, setAssessmentModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedType, setSelectedType] = useState<'quiz' | 'test' | 'mock_exam'>('quiz');

  // Timetable Helpers
  const getAttendanceStats = () => {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    return {
      total,
      present,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  };

  const getAttendanceForSchedule = (scheduleId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return attendance.find(a => a.scheduleId === scheduleId && a.date === today);
  };

  const handleCreateSchedule = () => {
    if (!newTimetableItem.title || !newTimetableItem.moduleId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const module = modules.find(m => m.id === newTimetableItem.moduleId);
    const scheduleItem = {
      id: Date.now().toString(),
      ...newTimetableItem,
      color: module?.color || COLORS[0],
      is_recurring: true,
    };

    addScheduleItem(scheduleItem);
    setTimetableModalVisible(false);
    setNewTimetableItem({
      title: '',
      moduleId: '',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });
  };

  const handleDeleteSchedule = (id: string, title: string) => {
    Alert.alert('Delete Class', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteScheduleItem(id) },
    ]);
  };

  const handleMarkAttendance = useCallback((scheduleId: string, status: 'present' | 'absent') => {
    const record = {
      id: Date.now().toString(),
      scheduleId,
      date: new Date().toISOString().split('T')[0],
      status,
    };
    addAttendance(record);
  }, [addAttendance]);

  // Assessment Helpers
  const filterAssessments = (type: 'quiz' | 'test' | 'mock_exam') => {
    return assessments.filter(a => a.type === type);
  };

  const getTotalScore = () => {
    const completed = assessments.filter(a => a.completed);
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, a) => sum + (a.score || 0), 0);
    return Math.round(total / completed.length);
  };

  const handleGenerateAssessment = () => {
    if (!selectedModule) {
      Alert.alert('Error', 'Please select a module');
      return;
    }

    const module = modules.find(m => m.id === selectedModule);
    if (!module) return;

    const questionCounts = {
      quiz: 10,
      test: 25,
      mock_exam: 50,
    };

    const assessmentItem: Assessment = {
      id: Date.now().toString(),
      moduleId: selectedModule,
      type: selectedType,
      title: `${module.name} ${selectedType.replace('_', ' ').toUpperCase()}`,
      questionCount: questionCounts[selectedType],
      completed: false,
    };

    addAssessment(assessmentItem);
    setAssessmentModalVisible(false);
    Alert.alert('Success', 'Assessment generated successfully!');
  };

  const timetableStats = getAttendanceStats();
  const todaySchedule = schedule.filter(s => s.dayOfWeek === new Date().getDay());

  const renderAssessmentCard = (assessment: Assessment) => {
    const module = modules.find(m => m.id === assessment.moduleId);
    return (
      <CustomCard key={assessment.id} style={styles.assessmentCard}>
        <View style={styles.assessmentHeader}>
          <View style={styles.assessmentInfo}>
            <View style={styles.assessmentTitleRow}>
              <Ionicons name="sparkles" size={16} color="#6366f1" />
              <Text style={styles.assessmentTitle}>{assessment.title}</Text>
            </View>
            <Text style={styles.moduleName}>{module?.name}</Text>
            <View style={styles.assessmentDetails}>
              <Text style={styles.questionCount}>{assessment.questionCount} questions</Text>
              {assessment.completed && assessment.score !== undefined && (
                <View style={[styles.scoreBadge, assessment.score >= 70 ? styles.scoreGood : styles.scoreBad]}>
                  <Text style={styles.scoreText}>Score: {assessment.score}%</Text>
                </View>
              )}
            </View>
          </View>
          {assessment.completed ? (
            <View style={styles.completedContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          ) : (
            <CustomButton
              title="Start"
              size="small"
              onPress={() => (navigation.navigate as any)('Quiz', { id: assessment.id })}
            />
          )}
        </View>
      </CustomCard>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedules</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'timetable' 
            ? 'Manage your timetable and track attendance' 
            : 'Generate AI assessments and test your knowledge'}
        </Text>
      </View>

      {/* Segmented Control Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'timetable' && styles.tabButtonActive]}
          onPress={() => setActiveTab('timetable')}
        >
          <Ionicons name="calendar-outline" size={20} color={activeTab === 'timetable' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabButtonText, activeTab === 'timetable' && styles.tabButtonTextActive]}>Timetable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'assessments' && styles.tabButtonActive]}
          onPress={() => setActiveTab('assessments')}
        >
          <Ionicons name="clipboard-outline" size={20} color={activeTab === 'assessments' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabButtonText, activeTab === 'assessments' && styles.tabButtonTextActive]}>Assessments</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'timetable' ? (
          <>
            {/* Timetable Stats */}
            <View style={styles.statsContainer}>
              <CustomCard style={styles.statCard}>
                <Text style={styles.statLabel}>Attendance Rate</Text>
                <Text style={styles.statValue}>{timetableStats.percentage}%</Text>
              </CustomCard>
              <CustomCard style={styles.statCard}>
                <Text style={styles.statLabel}>Classes Attended</Text>
                <Text style={[styles.statValue, styles.attendedStat]}>
                  {timetableStats.present}/{timetableStats.total}
                </Text>
              </CustomCard>
            </View>

            {/* Today's Classes */}
            {todaySchedule.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{"Today's Classes"}</Text>
                <View style={styles.todaySchedule}>
                  {todaySchedule.map(item => {
                    const attendanceRecord = getAttendanceForSchedule(item.id);
                    return (
                      <CustomCard key={item.id} style={styles.scheduleCard}>
                        <View style={styles.scheduleHeader}>
                          <View style={[styles.colorBar, { backgroundColor: item.color }]} />
                          <View style={styles.scheduleInfo}>
                            <Text style={styles.scheduleTitle}>{item.title}</Text>
                            <View style={styles.timeInfo}>
                              <Ionicons name="time-outline" size={14} color="#6b7280" />
                              <Text style={styles.timeText}>{item.startTime} - {item.endTime}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.attendanceButtons}>
                          <CustomButton
                            title="Present"
                            size="small"
                            variant={attendanceRecord?.status === 'present' ? 'primary' : 'outline'}
                            onPress={() => handleMarkAttendance(item.id, 'present')}
                            style={styles.attendanceButton}
                          />
                          <CustomButton
                            title="Absent"
                            size="small"
                            variant={attendanceRecord?.status === 'absent' ? 'danger' : 'outline'}
                            onPress={() => handleMarkAttendance(item.id, 'absent')}
                            style={styles.attendanceButton}
                          />
                        </View>
                      </CustomCard>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Add Schedule Button */}
            <CustomButton
              title="Add to Timetable"
              onPress={() => setTimetableModalVisible(true)}
              size="large"
              style={styles.addButton}
              icon={<Ionicons name="add" size={20} color="white" />}
            />

            {/* Weekly Timetable */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly Timetable</Text>
              {DAYS.map((day, dayIndex) => {
                const daySchedule = schedule.filter(s => s.dayOfWeek === dayIndex);
                return (
                  <CustomCard key={day} style={styles.dayCard}>
                    <Text style={styles.dayTitle}>{day}</Text>
                    {daySchedule.length === 0 ? (
                      <Text style={styles.noClassesText}>No classes scheduled</Text>
                    ) : (
                      <View style={styles.daySchedule}>
                        {daySchedule.map(item => (
                          <View key={item.id} style={styles.dayScheduleItem}>
                            <View style={[styles.scheduleColorDot, { backgroundColor: item.color }]} />
                            <View style={styles.dayScheduleInfo}>
                              <Text style={styles.dayScheduleTitle}>{item.title}</Text>
                              <Text style={styles.dayScheduleTime}>
                                {item.startTime} - {item.endTime}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDeleteSchedule(item.id, item.title)}
                              style={styles.deleteButton}
                            >
                              <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </CustomCard>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Assessment Stats */}
            <View style={styles.statsContainer}>
              <CustomCard style={styles.statCard}>
                <Text style={styles.statLabel}>Average Score</Text>
                <Text style={styles.statValue}>{getTotalScore()}%</Text>
              </CustomCard>
              <CustomCard style={styles.statCard}>
                <Text style={styles.statLabel}>Completed</Text>
                <Text style={[styles.statValue, styles.completedStat]}>
                  {assessments.filter(a => a.completed).length}
                </Text>
              </CustomCard>
            </View>

            {/* Generate Assessment Button */}
            <CustomButton
              title="Generate AI Assessment"
              onPress={() => setAssessmentModalVisible(true)}
              size="large"
              style={styles.generateButton}
              icon={<Ionicons name="sparkles" size={20} color="white" />}
            />

            {/* Assessments Sections */}
            <View style={styles.tabsContainer}>
              {(['quiz', 'test', 'mock_exam'] as const).map((type) => {
                const filtered = filterAssessments(type);
                return (
                  <View key={type} style={styles.tabSection}>
                    <Text style={styles.sectionTitle}>
                      {type === 'quiz' ? 'Quizzes' : type === 'test' ? 'Tests' : 'Mock Exams'}
                    </Text>
                    {filtered.length === 0 ? (
                      <View style={styles.emptyAssessments}>
                        <Ionicons name="time-outline" size={48} color="#d1d5db" />
                        <Text style={styles.emptyText}>No {type}s yet. Generate one to get started!</Text>
                      </View>
                    ) : (
                      <View style={styles.assessmentsList}>
                        {filtered.map(renderAssessmentCard)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Class Modal */}
      <AnimatedModal
        visible={timetableModalVisible}
        onClose={() => setTimetableModalVisible(false)}
        title="Add Class to Timetable"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Class Title</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g., Lecture, Tutorial"
            value={newTimetableItem.title}
            onChangeText={text => setNewTimetableItem({ ...newTimetableItem, title: text })}
          />

          <Text style={styles.modalLabel}>Module</Text>
          <View style={styles.moduleList}>
            {modules.map(module => (
              <TouchableOpacity
                key={module.id}
                style={[
                  styles.moduleOption,
                  newTimetableItem.moduleId === module.id && styles.moduleOptionSelected,
                ]}
                onPress={() => setNewTimetableItem({ ...newTimetableItem, moduleId: module.id })}
              >
                <View style={[styles.moduleColorDot, { backgroundColor: module.color }]} />
                <Text style={styles.moduleOptionText}>{module.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Day of Week</Text>
          <View style={styles.dayList}>
            {DAYS.map((day, index) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayOption,
                  newTimetableItem.dayOfWeek === index && styles.dayOptionSelected,
                ]}
                onPress={() => setNewTimetableItem({ ...newTimetableItem, dayOfWeek: index })}
              >
                <Text style={styles.dayOptionText}>{day.substring(0, 3)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.modalLabel}>Start Time</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="09:00"
                value={newTimetableItem.startTime}
                onChangeText={text => setNewTimetableItem({ ...newTimetableItem, startTime: text })}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.modalLabel}>End Time</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10:00"
                value={newTimetableItem.endTime}
                onChangeText={text => setNewTimetableItem({ ...newTimetableItem, endTime: text })}
              />
            </View>
          </View>

          <CustomButton title="Add to Schedule" onPress={handleCreateSchedule} />
        </View>
      </AnimatedModal>

      {/* Generate Assessment Modal */}
      <AnimatedModal
        visible={assessmentModalVisible}
        onClose={() => setAssessmentModalVisible(false)}
        title="Generate AI Assessment"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Select Module</Text>
          <View style={styles.moduleList}>
            {modules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={[
                  styles.moduleOption,
                  selectedModule === module.id && styles.moduleOptionSelected,
                ]}
                onPress={() => setSelectedModule(module.id)}
              >
                <View style={[styles.moduleColorDot, { backgroundColor: module.color }]} />
                <Text style={styles.moduleOptionText}>{module.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Assessment Type</Text>
          <View style={styles.typeList}>
            {(
              [
                { value: 'quiz', label: 'Quiz (10 questions)' },
                { value: 'test', label: 'Test (25 questions)' },
                { value: 'mock_exam', label: 'Mock Exam (50 questions)' },
              ] as const
            ).map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeOption,
                  selectedType === type.value && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType(type.value)}
              >
                <Text style={styles.typeOptionText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <CustomButton title="Generate" onPress={handleGenerateAssessment} />
        </View>
      </AnimatedModal>

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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: '#6366f1',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  attendedStat: {
    color: '#22c55e',
  },
  completedStat: {
    color: '#22c55e',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  todaySchedule: {
    gap: 12,
  },
  scheduleCard: {
    padding: 16,
    backgroundColor: 'white',
  },
  scheduleHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
  },
  scheduleInfo: {
    flex: 1,
    gap: 4,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  attendanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceButton: {
    flex: 1,
  },
  addButton: {
    marginBottom: 24,
  },
  generateButton: {
    marginBottom: 24,
  },
  dayCard: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  noClassesText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 8,
  },
  daySchedule: {
    gap: 8,
  },
  dayScheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  scheduleColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayScheduleInfo: {
    flex: 1,
  },
  dayScheduleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  dayScheduleTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  // Assessments tab styles
  tabsContainer: {
    gap: 20,
  },
  tabSection: {
    gap: 8,
  },
  assessmentsList: {
    gap: 12,
  },
  assessmentCard: {
    padding: 16,
    backgroundColor: 'white',
  },
  assessmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assessmentInfo: {
    flex: 1,
    gap: 6,
  },
  assessmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  moduleName: {
    fontSize: 13,
    color: '#6b7280',
  },
  assessmentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  questionCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreGood: {
    backgroundColor: '#dcfce7',
  },
  scoreBad: {
    backgroundColor: '#fee2e2',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  completedContainer: {
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyAssessments: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Modal styles
  modalContent: {
    gap: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  moduleList: {
    gap: 8,
  },
  moduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  moduleOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  moduleColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  moduleOptionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  dayList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  dayOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  dayOptionText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  typeList: {
    gap: 8,
  },
  typeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  typeOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
});