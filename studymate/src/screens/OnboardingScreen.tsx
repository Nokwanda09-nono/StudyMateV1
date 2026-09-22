import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { CustomButton } from '../components/CustomButton';
import { CustomCard } from '../components/CustomCard';

const TOTAL_STEPS = 7;

export function OnboardingScreen() {
  const navigation = useNavigation();
  const { setProfile } = useStore();
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfileState] = useState({
    studyHoursPerDay: undefined as number | undefined,
    studyDaysPerWeek: undefined as number | undefined,
    academicGoal: undefined as string | undefined,
    studyStyle: undefined as string | undefined,
    fieldOfStudy: undefined as string | undefined,
    academicLevel: undefined as string | undefined,
    preferredStudyTime: undefined as string | undefined,
  });

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setProfile(profile as any);
    await completeOnboarding();
    Alert.alert('Success', 'Profile completed! Welcome to Study Mate!');
    (navigation.navigate as any)('Main');
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return profile.studyHoursPerDay !== undefined;
      case 2:
        return profile.studyDaysPerWeek !== undefined;
      case 3:
        return profile.academicGoal !== undefined;
      case 4:
        return profile.studyStyle !== undefined;
      case 5:
        return profile.fieldOfStudy !== undefined;
      case 6:
        return profile.academicLevel !== undefined;
      case 7:
        return profile.preferredStudyTime !== undefined;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>How many hours per day do you prefer to study?</Text>
            <View style={styles.optionsGrid}>
              {[1, 2, 3, 4, 5, 6].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  style={[
                    styles.optionButton,
                    profile.studyHoursPerDay === hours && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, studyHoursPerDay: hours })}
                >
                  <Text style={[
                    styles.optionText,
                    profile.studyHoursPerDay === hours && styles.optionTextSelected,
                  ]}>
                    {hours} {hours === 1 ? 'hour' : 'hours'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>How many days per week do you study?</Text>
            <View style={styles.optionsGrid}>
              {[3, 4, 5, 6, 7].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.optionButton,
                    profile.studyDaysPerWeek === days && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, studyDaysPerWeek: days })}
                >
                  <Text style={[
                    styles.optionText,
                    profile.studyDaysPerWeek === days && styles.optionTextSelected,
                  ]}>
                    {days} {days === 1 ? 'day' : 'days'} per week
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>What is your primary academic goal?</Text>
            <View style={styles.optionsList}>
              {[
                { value: 'graduate', label: 'Graduate with honors' },
                { value: 'improve', label: 'Improve current grades' },
                { value: 'pass', label: 'Pass all courses' },
                { value: 'master', label: 'Master specific subjects' },
                { value: 'exam', label: 'Prepare for exams' },
              ].map((goal) => (
                <TouchableOpacity
                  key={goal.value}
                  style={[
                    styles.listOption,
                    profile.academicGoal === goal.value && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, academicGoal: goal.value })}
                >
                  <Text style={[
                    styles.optionText,
                    profile.academicGoal === goal.value && styles.optionTextSelected,
                  ]}>
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>{"What's your preferred study style?"}</Text>
            <View style={styles.optionsList}>
              {[
                { value: 'visual', label: 'Visual (diagrams, charts, images)', icon: 'eye' },
                { value: 'auditory', label: 'Auditory (lectures, discussions)', icon: 'headset' },
                { value: 'reading', label: 'Reading/Writing (notes, textbooks)', icon: 'book' },
                { value: 'kinesthetic', label: 'Kinesthetic (hands-on, practice)', icon: 'fitness' },
              ].map((style) => (
                <TouchableOpacity
                  key={style.value}
                  style={[
                    styles.listOption,
                    profile.studyStyle === style.value && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, studyStyle: style.value })}
                >
                  <Ionicons name={style.icon as any} size={24} color={profile.studyStyle === style.value ? '#6366f1' : '#9ca3af'} />
                  <Text style={[
                    styles.optionText,
                    profile.studyStyle === style.value && styles.optionTextSelected,
                    { marginLeft: 12, flex: 1 }
                  ]}>
                    {style.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>What is your field of study?</Text>
            <View style={styles.optionsList}>
              {[
                { value: 'computer-science', label: 'Computer Science' },
                { value: 'engineering', label: 'Engineering' },
                { value: 'business', label: 'Business' },
                { value: 'medicine', label: 'Medicine' },
                { value: 'law', label: 'Law' },
                { value: 'arts', label: 'Arts & Humanities' },
                { value: 'sciences', label: 'Natural Sciences' },
                { value: 'social-sciences', label: 'Social Sciences' },
                { value: 'other', label: 'Other' },
              ].map((field) => (
                <TouchableOpacity
                  key={field.value}
                  style={[
                    styles.listOption,
                    profile.fieldOfStudy === field.value && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, fieldOfStudy: field.value })}
                >
                  <Text style={[
                    styles.optionText,
                    profile.fieldOfStudy === field.value && styles.optionTextSelected,
                  ]}>
                    {field.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>What is your current academic level?</Text>
            <View style={styles.optionsList}>
              {[
                { value: 'high-school', label: 'High School' },
                { value: 'undergraduate', label: 'Undergraduate' },
                { value: 'graduate', label: 'Graduate' },
                { value: 'phd', label: 'PhD' },
              ].map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.listOption,
                    profile.academicLevel === level.value && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, academicLevel: level.value })}
                >
                  <Text style={[
                    styles.optionText,
                    profile.academicLevel === level.value && styles.optionTextSelected,
                  ]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.questionText}>When do you prefer to study?</Text>
            <View style={styles.optionsList}>
              {[
                { value: 'morning', label: 'Morning (6 AM - 12 PM)', icon: 'sunny' },
                { value: 'afternoon', label: 'Afternoon (12 PM - 6 PM)', icon: 'sunny-outline' },
                { value: 'evening', label: 'Evening (6 PM - 10 PM)', icon: 'moon' },
                { value: 'night', label: 'Night (10 PM - 2 AM)', icon: 'moon-outline' },
              ].map((time) => (
                <TouchableOpacity
                  key={time.value}
                  style={[
                    styles.listOption,
                    profile.preferredStudyTime === time.value && styles.optionSelected,
                  ]}
                  onPress={() => setProfileState({ ...profile, preferredStudyTime: time.value })}
                >
                  <Ionicons name={time.icon as any} size={24} color={profile.preferredStudyTime === time.value ? '#6366f1' : '#9ca3af'} />
                  <Text style={[
                    styles.optionText,
                    profile.preferredStudyTime === time.value && styles.optionTextSelected,
                    { marginLeft: 12 }
                  ]}>
                    {time.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <LinearGradient colors={['#eef2ff', '#fae8ff']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CustomCard style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="school" size={40} color="white" />
          </View>
          
          <Text style={styles.title}>{"Let's Get to Know You"}</Text>
          <Text style={styles.subtitle}>Help us personalize your study experience</Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>Step {step} of {TOTAL_STEPS}</Text>
          </View>

          {renderStepContent()}

          <View style={styles.navigationButtons}>
            <CustomButton
              title="Back"
              variant="outline"
              onPress={handleBack}
              disabled={step === 1}
              style={styles.navButton}
            />
            <CustomButton
              title={step === TOTAL_STEPS ? "Complete" : "Next"}
              onPress={handleNext}
              disabled={!canProceed()}
              style={styles.navButton}
            />
          </View>
        </CustomCard>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    padding: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  stepContainer: {
    minHeight: 300,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  optionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#6366f1',
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navButton: {
    flex: 1,
  },
});