import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';

interface Message {
  id: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', sender: 'System', text: 'Welcome to the Issues chat. Report any problems or ask questions here.', time: '10:00 AM', isMe: false },
  { id: '2', sender: 'Support', text: 'How can we help you today?', time: '10:02 AM', isMe: false },
];

export default function IssuesScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date();
    const time = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: user?.displayName || 'User',
      text: trimmed,
      time,
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgBubble, item.isMe ? styles.meBubble : styles.otherBubble, { backgroundColor: item.isMe ? '#1B2A4A' : (colors.surface || '#F1F5F9'), borderColor: item.isMe ? '#1B2A4A' : colors.border }]}>
      {!item.isMe && <Text style={[styles.msgSender, { color: colors.primary }]}>{item.sender}</Text>}
      <Text style={[styles.msgText, { color: item.isMe ? '#FFFFFF' : colors.text }]}>{item.text}</Text>
      <Text style={[styles.msgTime, { color: item.isMe ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>{item.time}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.lg }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#1B2A4A' }]} onPress={sendMessage}>
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  msgBubble: {
    maxWidth: '82%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  meBubble: {
    alignSelf: 'flex-end',
    borderWidth: 0,
  },
  otherBubble: {
    alignSelf: 'flex-start',
  },
  msgSender: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 14,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});