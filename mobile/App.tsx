import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// --- Helper for the injected script ---
import { automationScript } from './src/automation_string';

export default function App() {
  const [groups, setGroups] = useState('');
  const [comments, setComments] = useState('');
  const [maxPosts, setMaxPosts] = useState('5');
  const [delay, setDelay] = useState('10');
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('https://m.facebook.com');

  const webViewRef = useRef(null);

  // Load settings on boot
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedGroups = await AsyncStorage.getItem('groups');
      const savedComments = await AsyncStorage.getItem('comments');
      if (savedGroups) setGroups(savedGroups);
      if (savedComments) setComments(savedComments);
    } catch (e) {
      addLog('Lỗi tải cài đặt!');
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('groups', groups);
      await AsyncStorage.setItem('comments', comments);
      addLog('Đã lưu dữ liệu thành công!');
    } catch (e) {
      addLog('Lỗi lưu cài đặt!');
    }
  };

  const addLog = (msg) => {
    setLogs(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev].slice(0, 50));
  };

  const startBot = () => {
    if (isRunning) return;
    const groupList = groups.split('\n').filter(g => g.trim() !== '');
    if (groupList.length === 0) return alert('Dán link nhóm trước khi chạy!');
    
    setIsRunning(true);
    setCurrentGroupIndex(0);
    setCurrentUrl(groupList[0]);
    addLog('Bắt đầu Bot -> ' + groupList[0]);
  };

  const stopBot = () => {
    setIsRunning(false);
    webViewRef.current?.postMessage(JSON.stringify({ type: 'stop' }));
    addLog('Đã dừng bot khẩn cấp.');
  };

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'log') {
        addLog('Browser log: ' + data.message);
      } else if (data.type === 'progress') {
        addLog('Đã bình luận thành công bài viết thứ ' + data.count);
      }
    } catch (e) {}
  };

  const handleWebViewLoad = () => {
    if (isRunning) {
      const commentList = comments.split('\n').filter(c => c.trim() !== '');
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'start',
        config: {
          maxPosts: parseInt(maxPosts),
          delay: parseInt(delay),
          comments: commentList
        }
      }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.title}>FB BOT 100% MOBILE</Text>
      </View>

      <ScrollView style={styles.dashboard}>
        <View style={styles.card}>
          <Text style={styles.label}>DANH SÁCH NHÓM (URL)</Text>
          <TextInput 
            style={[styles.input, { height: 80 }]} 
            multiline 
            placeholder="https://..." 
            placeholderTextColor="#666"
            value={groups}
            onChangeText={setGroups}
          />

          <Text style={styles.label}>DANH SÁCH BÌNH LUẬN</Text>
          <TextInput 
            style={[styles.input, { height: 80 }]} 
            multiline 
            placeholder="Chào bạn..." 
            placeholderTextColor="#666"
            value={comments}
            onChangeText={setComments}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>SỐ BÀI / NHÓM</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={maxPosts} onChangeText={setMaxPosts} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>DELAY (S)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={delay} onChangeText={setDelay} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={saveSettings}>
              <Text style={styles.btnText}>Lưu dữ liệu</Text>
            </TouchableOpacity>
            {!isRunning ? (
              <TouchableOpacity style={[styles.btn, styles.btnStart]} onPress={startBot}>
                <Text style={styles.btnText}>Bắt đầu chạy</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopBot}>
                <Text style={styles.btnText}>Dừng lại</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.logCard}>
          <Text style={styles.label}>NHẬT KÝ HOẠT ĐỘNG</Text>
          <View style={styles.logBox}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{log}</Text>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Hidden/Visible WebView depending on debugging needs. For now 100px so user can login */}
      <View style={{ height: 200, width: '100%', borderTopWidth: 1, borderTopColor: '#333' }}>
        <WebView 
          ref={webViewRef}
          source={{ uri: currentUrl }}
          onMessage={onMessage}
          injectedJavaScript={automationScript}
          onLoad={handleWebViewLoad}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222' },
  title: { color: '#2196F3', fontSize: 20, fontWeight: 'bold' },
  dashboard: { flex: 1, padding: 15 },
  card: { backgroundColor: '#111', padding: 15, borderRadius: 10, borderBorderColor: '#222', borderBottomWidth: 1 },
  label: { color: '#888', fontSize: 12, marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#1a1a1a', borderRadius: 5, padding: 10, color: '#fff', marginBottom: 15, borderBorderColor: '#333', borderBottomWidth: 1 },
  row: { flexDirection: 'row' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 5, alignItems: 'center', marginHorizontal: 2 },
  btnSave: { backgroundColor: '#333' },
  btnStart: { backgroundColor: '#4CAF50' },
  btnStop: { backgroundColor: '#F44336' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  logCard: { marginTop: 20, backgroundColor: '#111', padding: 15, borderRadius: 10, height: 200 },
  logBox: { flex: 1, marginTop: 5 },
  logText: { color: '#0f0', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
});
