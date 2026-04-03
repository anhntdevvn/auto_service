import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Keyboard, TouchableWithoutFeedback, Modal, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

const { width, height: screenHeight } = Dimensions.get('window');

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

  // New state for Fetch Groups
  const [fetchedGroups, setFetchedGroups] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

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

  const fetchGroups = () => {
    setIsFetching(true);
    setCurrentUrl('https://m.facebook.com/groups/?category=membership');
    addLog('Đang chuyển hướng đến trang danh sách nhóm...');
    // Give it more time to load before triggering script
  };

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'log') {
        addLog('Bot: ' + data.message);
      } else if (data.type === 'progress') {
        addLog('Đã bình luận thành công bài viết thứ ' + data.count);
      } else if (data.type === 'groups_fetched') {
        setFetchedGroups(data.message.map(g => ({ ...g, selected: true })));
        setShowSelector(true);
        setIsFetching(false);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isFetching && currentUrl.includes('membership')) {
      const timer = setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({ type: 'fetch_groups' }));
      }, 5000); // Wait 5s for FB to load the list
      return () => clearTimeout(timer);
    }
  }, [currentUrl, isFetching]);

  const handleWebViewLoad = () => {
    if (isRunning && !isFetching) {
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

  const toggleGroupSelection = (index) => {
    const updated = [...fetchedGroups];
    updated[index].selected = !updated[index].selected;
    setFetchedGroups(updated);
  };

  const confirmSelection = () => {
    const selectedUrls = fetchedGroups
      .filter(g => g.selected)
      .map(g => g.url)
      .join('\n');
    setGroups(selectedUrls);
    setShowSelector(false);
    addLog(`Đã chọn ${fetchedGroups.filter(g => g.selected).length} nhóm!`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title}>FB BOT 100% MOBILE</Text>
          </View>

          <ScrollView style={styles.dashboard} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>DANH SÁCH NHÓM (URL)</Text>
                <TouchableOpacity onPress={fetchGroups}>
                  <Text style={styles.fetchText}>[Lấy từ FB của tôi]</Text>
                </TouchableOpacity>
              </View>
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
        </View>
      </TouchableWithoutFeedback>

      {/* Group Selector Modal */}
      <Modal visible={showSelector} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CHỌN NHÓM ĐỂ CHẠY</Text>
            <FlatList
              data={fetchedGroups}
              keyExtractor={(item) => item.url}
              renderItem={({ item, index }) => (
                <TouchableOpacity style={styles.groupItem} onPress={() => toggleGroupSelection(index)}>
                  <View style={[styles.checkbox, item.selected && styles.checkboxSelected]} />
                  <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#444' }]} onPress={() => setShowSelector(false)}>
                <Text style={styles.btnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#2196F3' }]} onPress={confirmSelection}>
                <Text style={styles.btnText}>Hoàn tất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WebView */}
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
  card: { backgroundColor: '#111', padding: 15, borderRadius: 10, borderColor: '#222', borderWidth: 1 },
  label: { color: '#888', fontSize: 12, marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#1a1a1a', borderRadius: 5, padding: 10, color: '#fff', marginBottom: 15, borderColor: '#333', borderWidth: 1 },
  row: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fetchText: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 5, alignItems: 'center', marginHorizontal: 2 },
  btnSave: { backgroundColor: '#333' },
  btnStart: { backgroundColor: '#4CAF50' },
  btnStop: { backgroundColor: '#F44336' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  logCard: { marginTop: 20, backgroundColor: '#111', padding: 15, borderRadius: 10, height: 200 },
  logBox: { flex: 1, marginTop: 5 },
  logText: { color: '#0f0', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', borderRadius: 10, padding: 20, maxHeight: screenHeight * 0.8, borderColor: '#333', borderWidth: 1 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  groupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 2, borderColor: '#2196F3', marginRight: 10 },
  checkboxSelected: { backgroundColor: '#2196F3' },
  groupName: { color: '#fff', fontSize: 14, flex: 1 },
  modalActions: { flexDirection: 'row', marginTop: 20 }
});
