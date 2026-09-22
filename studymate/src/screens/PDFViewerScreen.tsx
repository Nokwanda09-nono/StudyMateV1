import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useStore } from '../context/StoreContext';
import { CustomButton } from '../components/CustomButton';

export function PDFViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { fileId } = route.params as { fileId: string };
  const { files } = useStore();
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  
  const file = files.find(f => f.id === fileId);

  if (!file) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>File not found</Text>
          <CustomButton title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  const getPDFHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=${zoom / 100}, user-scalable=yes">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f3f4f6;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .header {
              text-align: center;
              padding-bottom: 20px;
              border-bottom: 1px solid #e5e7eb;
              margin-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #111827;
            }
            .filename {
              font-size: 14px;
              color: #6b7280;
              margin-top: 8px;
            }
            .content {
              color: #374151;
              line-height: 1.6;
            }
            .page {
              margin-bottom: 30px;
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">PDF Preview</div>
              <div class="filename">${file.name}</div>
            </div>
            <div class="content">
              ${Array.from({ length: 15 }, (_, i) => `
                <div class="page">
                  <h3>Page ${i + 1}</h3>
                  <p>This is a preview of page ${i + 1} of the document "${file.name}".</p>
                  <p>In a production environment, this would display the actual PDF content using a proper PDF rendering library.</p>
                  <p>The document contains important study materials and notes for your module.</p>
                </div>
              `).join('')}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{file.name}</Text>
          </View>
          <View style={styles.zoomControls}>
            <TouchableOpacity onPress={handleZoomOut} style={styles.zoomButton}>
              <Ionicons name="remove-outline" size={20} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.zoomText}>{zoom}%</Text>
            <TouchableOpacity onPress={handleZoomIn} style={styles.zoomButton}>
              <Ionicons name="add-outline" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loaderText}>Loading PDF...</Text>
        </View>
      )}

      <WebView
        source={{ html: getPDFHTML() }}
        style={[styles.webview, loading && styles.hidden]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        scalesPageToFit={Platform.OS === 'ios'}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  header: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 14,
    color: 'white',
    minWidth: 45,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  hidden: {
    opacity: 0,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
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