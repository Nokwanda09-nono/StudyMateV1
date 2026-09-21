declare module 'expo-linear-gradient';
declare module 'expo-blur';
declare module 'react-native-webview';
declare module 'expo-document-picker';
declare module '@react-native-async-storage/async-storage';
declare module 'expo-device';
declare module 'expo-image';
declare module 'expo-symbols';
declare module 'react-native-worklets';

declare module '*.css' {
  const content: any;
  export default content;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
