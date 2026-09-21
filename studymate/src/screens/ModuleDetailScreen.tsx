import React from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useStore } from '../context/StoreContext';
import { CustomCard } from '../components/CustomCard';
import { CustomButton } from '../components/CustomButton';

export function ModuleDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const { modules, files, addFile, deleteFile } = useStore();
  
  const module = modules.find(m => m.id === id);
  const moduleFiles = files.filter(f => f.moduleId === id);

  if (!module) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Module not found</Text>
          <CustomButton title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      for (const file of result.assets) {
        const fileInfo = await FileSystem.getInfoAsync(file.uri);
        const fileItem = {
          id: Date.now().toString() + Math.random(),
          moduleId: module.id,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
          size: fileInfo.exists ? fileInfo.size : 0,
          uploadedAt: new Date(),
          uri: file.uri,
        };
        addFile(fileItem as any);
      }

      Alert.alert('Success', `${result.assets.length} file(s) uploaded successfully!`);
    } catch {
      Alert.alert('Error', 'Failed to upload files');
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    Alert.alert('Delete File', `Are you sure you want to delete "${fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFile(fileId) },
    ]);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('image')) return 'image';
    return 'document';
  };

  const getFileColor = (type: string) => {
    if (type.includes('pdf')) return '#ef4444';
    if (type.includes('image')) return '#3b82f6';
    return '#6b7280';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderFile = ({ item }: { item: any }) => (
    <CustomCard style={styles.fileCard}>
      <TouchableOpacity
        style={styles.fileContent}
        onPress={() => {
          if (item.type.includes('pdf')) {
            (navigation.navigate as any)('PDFViewer', { fileId: item.id });
          }
        }}
      >
        <View style={[styles.fileIconContainer, { backgroundColor: getFileColor(item.type) + '20' }]}>
          <Ionicons name={getFileIcon(item.type)} size={32} color={getFileColor(item.type)} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.fileMeta}>
            <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
            <Text style={styles.fileDate}>
              {new Date(item.uploadedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteFile(item.id, item.name)}
          style={styles.deleteFileButton}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    </CustomCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{module.name}</Text>
            <Text style={styles.headerSubtitle}>{moduleFiles.length} files</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CustomButton
          title="Upload Files"
          onPress={handleFileUpload}
          size="large"
          style={styles.uploadButton}
          icon={<Ionicons name="cloud-upload" size={20} color="white" />}
        />

        {moduleFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>No files yet</Text>
            <Text style={styles.emptyStateText}>
              Upload PDFs, images, or documents to get started
            </Text>
          </View>
        ) : (
          <View style={styles.filesList}>
             {moduleFiles.map((file) => renderFile({ item: file }))}
          </View>
        )}
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
    paddingVertical: 16,
  },
  headerContent: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
  },
  uploadButton: {
    marginBottom: 24,
  },
  filesList: {
    gap: 12,
  },
  fileCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  fileMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  fileDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteFileButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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