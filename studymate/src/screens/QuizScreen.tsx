import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useStore } from '../context/StoreContext';
import { CustomCard } from '../components/CustomCard';
import { CustomButton } from '../components/CustomButton';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

const generateMockQuestions = (count: number): Question[] => {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    questions.push({
      id: i + 1,
      question: `Question ${i + 1}: Which of the following best describes the concept discussed in the study material?`,
      options: [
        "Option A: The primary approach focuses on systematic methodology",
        "Option B: The secondary approach emphasizes practical application",
        "Option C: The tertiary approach combines theoretical frameworks",
        "Option D: The quaternary approach integrates all previous methods",
      ],
      correctAnswer: Math.floor(Math.random() * 4),
    });
  }
  return questions;
};

export function QuizScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const { assessments, updateAssessment } = useStore();
  
  const assessment = assessments.find(a => a.id === id);
  const [questions] = useState(() => generateMockQuestions(assessment?.questionCount || 10));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  if (!assessment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Assessment not found</Text>
          <CustomButton title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const handleSelectAnswer = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    const correctCount = questions.reduce((count, question, index) => {
      return count + (selectedAnswers[index] === question.correctAnswer ? 1 : 0);
    }, 0);

    const score = Math.round((correctCount / questions.length) * 100);
    
    updateAssessment(assessment.id, {
      completed: true,
      score: score,
    });

    setShowResults(true);
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Quiz',
      'Are you sure you want to exit? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const getScore = () => {
    const correctCount = questions.reduce((count, question, index) => {
      return count + (selectedAnswers[index] === question.correctAnswer ? 1 : 0);
    }, 0);
    return {
      correct: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100),
    };
  };

  if (showResults) {
    const score = getScore();
    const passed = score.percentage >= 70;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (navigation.navigate as any)('Main')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Results</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <CustomCard style={styles.resultsCard}>
            <View style={styles.resultsIcon}>
              {passed ? (
                <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
              ) : (
                <Ionicons name="close-circle" size={80} color="#f97316" />
              )}
            </View>
            <Text style={styles.scorePercentage}>{score.percentage}%</Text>
            <Text style={styles.scoreText}>
              You got {score.correct} out of {score.total} questions correct
            </Text>
            <Text style={[styles.feedbackText, passed ? styles.feedbackPass : styles.feedbackFail]}>
              {passed 
                ? "Great job! Keep up the good work!"
                : "Good effort! Review the material and try again."}
            </Text>
            <CustomButton
              title="Back to Achievements"
              onPress={() => (navigation.navigate as any)('Main')}
              size="large"
              style={styles.backToAchievements}
            />
          </CustomCard>

          <Text style={styles.reviewTitle}>Review Answers</Text>
          <View style={styles.reviewList}>
            {questions.map((question, index) => {
              const isCorrect = selectedAnswers[index] === question.correctAnswer;
              return (
                <CustomCard key={question.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {isCorrect ? (
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    ) : (
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    )}
                    <Text style={styles.reviewQuestion}>{question.question}</Text>
                  </View>
                  <View style={styles.reviewOptions}>
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selectedAnswers[index] === optionIndex;
                      const isCorrectOption = question.correctAnswer === optionIndex;
                      let optionStyle: any = styles.reviewOption;
                      if (isCorrectOption) {
                        optionStyle = { ...optionStyle, ...styles.correctOption };
                      } else if (isSelected && !isCorrectOption) {
                        optionStyle = { ...optionStyle, ...styles.wrongOption };
                      }
                      return (
                        <View key={optionIndex} style={optionStyle}>
                          <Text style={styles.reviewOptionText}>{option}</Text>
                        </View>
                      );
                    })}
                  </View>
                </CustomCard>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{assessment.title}</Text>
          <Text style={styles.headerSubtitle}>
            Question {currentQuestion + 1} of {questions.length}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CustomCard style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQ.question}</Text>
          
          <View style={styles.optionsContainer}>
            {currentQ.options.map((option, index) => {
              const isSelected = selectedAnswers[currentQuestion] === index;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => handleSelectAnswer(index)}
                >
                  <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                    {isSelected && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </CustomCard>

        <View style={styles.navigationButtons}>
          <CustomButton
            title="Previous"
            variant="outline"
            onPress={handlePrevious}
            disabled={currentQuestion === 0}
            style={styles.navButton}
          />
          <CustomButton
            title={currentQuestion === questions.length - 1 ? "Submit" : "Next"}
            onPress={handleNext}
            disabled={selectedAnswers[currentQuestion] === undefined}
            style={styles.navButton}
          />
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  scrollContent: {
    padding: 16,
  },
  questionCard: {
    padding: 20,
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  optionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: {
    borderColor: '#6366f1',
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  optionTextSelected: {
    color: '#6366f1',
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
  },
  resultsCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  resultsIcon: {
    marginBottom: 16,
  },
  scorePercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  feedbackPass: {
    color: '#22c55e',
  },
  feedbackFail: {
    color: '#f97316',
  },
  backToAchievements: {
    width: '100%',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  reviewList: {
    gap: 16,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reviewQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  reviewOptions: {
    gap: 8,
  },
  reviewOption: {
    padding: 10,
    borderRadius: 6,
  },
  correctOption: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  wrongOption: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  reviewOptionText: {
    fontSize: 13,
    color: '#374151',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
});