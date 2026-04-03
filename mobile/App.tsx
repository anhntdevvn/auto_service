import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Keyboard, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { facebookWebViewBridgeScript } from './src/facebook_webview_bridge';

const { height: screenHeight } = Dimensions.get('window');

const GROUPS_MEMBERSHIP_URL = 'https://m.facebook.com/groups/?category=membership';

type BotConfig = {
  comments: string[];
  delay: number;
  maxPosts: number;
};

type BridgeCommand =
  | { type: 'fetch_groups' }
  | { type: 'stop' }
  | { config: BotConfig; type: 'start' };

type FetchedGroup = {
  name: string;
  selected: boolean;
  url: string;
};

type BridgeMessage =
  | { message?: string; type: 'groups_fetch_empty' | 'groups_fetch_error' | 'groups_fetch_started' | 'log' }
  | { message: Array<{ name: string; url: string }>; type: 'groups_fetched' }
  | { count?: number; message?: { count?: number }; type: 'progress' };

export default function App() {
  const [groups, setGroups] = useState('');
  const [comments, setComments] = useState('');
  const [maxPosts, setMaxPosts] = useState('5');
  const [delay, setDelay] = useState('10');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://m.facebook.com');
  const [fetchedGroups, setFetchedGroups] = useState<FetchedGroup[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const loadedUrlRef = useRef(currentUrl);

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

  const addLog = (message: string) => {
    setLogs((previousLogs) => [new Date().toLocaleTimeString() + ': ' + message, ...previousLogs].slice(0, 50));
  };

  const parsePositiveInt = (value: string, fallback: number) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

  const buildStartCommand = (): BridgeCommand => ({
    type: 'start',
    config: {
      maxPosts: parsePositiveInt(maxPosts, 5),
      delay: parsePositiveInt(delay, 10),
      comments: comments.split('\n').map((comment) => comment.trim()).filter(Boolean),
    },
  });

  const buildBridgeInjection = (command: BridgeCommand) => {
    const serializedCommand = JSON.stringify(command);
    const escapedCommand = JSON.stringify(serializedCommand);

    return `
      (function() {
        var payload = ${escapedCommand};

        try {
          var command = JSON.parse(payload);
          if (window.__FB_BOT_BRIDGE__ && typeof window.__FB_BOT_BRIDGE__.receiveCommand === 'function') {
            window.__FB_BOT_BRIDGE__.receiveCommand(command);
          } else if (window.postMessage) {
            var raw = JSON.stringify(command);
            window.postMessage(raw, '*');

            try {
              var messageEvent = new MessageEvent('message', { data: raw });
              if (document && typeof document.dispatchEvent === 'function') {
                document.dispatchEvent(messageEvent);
              }
              if (window && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(messageEvent);
              }
            } catch (messageEventError) {}
          }
        } catch (error) {
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Không thể gửi lệnh bridge: ' + error.message
            }));
          }
        }

        true;
      })();
    `;
  };

  const sendBridgeCommand = (command: BridgeCommand) => {
    webViewRef.current?.injectJavaScript(buildBridgeInjection(command));
  };

  const startBot = () => {
    if (isRunning) return;

    const groupList = groups.split('\n').map((group) => group.trim()).filter(Boolean);
    if (groupList.length === 0) {
      Alert.alert('Thiếu danh sách nhóm', 'Dán link nhóm trước khi chạy bot.');
      return;
    }

    setIsRunning(true);
    addLog('Bắt đầu Bot -> ' + groupList[0]);

    if (normalizeUrl(loadedUrlRef.current) === normalizeUrl(groupList[0])) {
      sendBridgeCommand(buildStartCommand());
      return;
    }

    setCurrentUrl(groupList[0]);
  };

  const stopBot = () => {
    setIsRunning(false);
    sendBridgeCommand({ type: 'stop' });
    addLog('Đã dừng bot khẩn cấp.');
  };

  const fetchGroups = () => {
    if (isFetching) {
      addLog('Đang quét nhóm, vui lòng chờ thêm một chút...');
      return;
    }

    setIsFetching(true);
    setFetchedGroups([]);
    setShowSelector(false);
    addLog('Đang mở danh sách nhóm Facebook của bạn...');

    if (normalizeUrl(loadedUrlRef.current) === normalizeUrl(GROUPS_MEMBERSHIP_URL)) {
      sendBridgeCommand({ type: 'fetch_groups' });
      return;
    }

    setCurrentUrl(GROUPS_MEMBERSHIP_URL);
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as BridgeMessage;
      if (data.type === 'log') {
        if (data.message) {
          addLog('Bot: ' + data.message);
        }
      } else if (data.type === 'progress') {
        const progressCount = typeof data.count === 'number' ? data.count : data.message?.count;
        if (typeof progressCount === 'number') {
          addLog('Đã bình luận thành công bài viết thứ ' + progressCount);
        }
      } else if (data.type === 'groups_fetch_started') {
        if (data.message) {
          addLog('Bot: ' + data.message);
        }
      } else if (data.type === 'groups_fetched') {
        const availableGroups = Array.isArray(data.message)
          ? data.message
              .filter((group) => Boolean(group?.name && group?.url))
              .map((group) => ({ ...group, selected: true }))
          : [];

        setIsFetching(false);
        if (availableGroups.length === 0) {
          addLog('Bot: Quét xong nhưng không có nhóm hợp lệ nào.');
          Alert.alert('Không tìm thấy nhóm', 'Facebook không trả về nhóm hợp lệ trên trang hiện tại.');
          return;
        }

        setFetchedGroups(availableGroups);
        setShowSelector(true);
        addLog('Bot: Đã lấy được ' + availableGroups.length + ' nhóm.');
      } else if (data.type === 'groups_fetch_empty') {
        setIsFetching(false);
        setFetchedGroups([]);
        setShowSelector(false);
        const message = data.message || 'Không tìm thấy nhóm nào trên trang hiện tại.';
        addLog('Bot: ' + message);
        Alert.alert('Không tìm thấy nhóm', message);
      } else if (data.type === 'groups_fetch_error') {
        setIsFetching(false);
        setFetchedGroups([]);
        setShowSelector(false);
        const message = data.message || 'Không thể lấy danh sách nhóm từ Facebook.';
        addLog('Bot: ' + message);
        Alert.alert('Không thể lấy nhóm', message);
      }
    } catch (error) {
      addLog('Không đọc được phản hồi từ WebView.');
    }
  };

  const handleWebViewLoadEnd = (event: { nativeEvent: { url: string } }) => {
    loadedUrlRef.current = event.nativeEvent.url;

    if (isFetching) {
      addLog('Trang danh sách nhóm đã tải, bắt đầu quét...');
      sendBridgeCommand({ type: 'fetch_groups' });
      return;
    }

    if (isRunning) {
      sendBridgeCommand(buildStartCommand());
    }
  };

  const toggleGroupSelection = (index: number) => {
    setFetchedGroups((previousGroups) =>
      previousGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, selected: !group.selected } : group
      )
    );
  };

  const confirmSelection = () => {
    const selectedGroups = fetchedGroups.filter((group) => group.selected);
    if (selectedGroups.length === 0) {
      Alert.alert('Chưa chọn nhóm', 'Hãy chọn ít nhất một nhóm để đưa vào danh sách chạy.');
      return;
    }

    const selectedUrls = selectedGroups.map((group) => group.url).join('\n');
    setGroups(selectedUrls);
    setShowSelector(false);
    addLog('Đã chọn ' + selectedGroups.length + ' nhóm!');
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
                <TouchableOpacity disabled={isFetching} onPress={fetchGroups}>
                  <Text style={[styles.fetchText, isFetching && styles.fetchTextDisabled]}>
                    {isFetching ? '[Đang lấy nhóm...]' : '[Lấy từ FB của tôi]'}
                  </Text>
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
          injectedJavaScript={facebookWebViewBridgeScript}
          onLoadEnd={handleWebViewLoadEnd}
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
  fetchTextDisabled: { color: '#6b93c7' },
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
