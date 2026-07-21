import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { DataCard, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { fetchIssues, createIssue, updateIssue, deleteIssue } from '../../services/api';
import { normalizeRole } from '../../utils/access';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#7C3AED',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#F59E0B',
  IN_REVIEW: '#2563EB',
  IN_PROGRESS: '#7C3AED',
  RESOLVED: '#10B981',
  REJECTED: '#EF4444',
};

export default function IssuesScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role);
  const isManagement = role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const data = await fetchIssues(params);
      setIssues(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Description is required.');
      return;
    }
    setSubmitting(true);
    try {
      await createIssue({ title: title.trim(), description: description.trim(), category, priority });
      Alert.alert('Success', 'Issue submitted successfully.');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setCategory('general');
      setPriority('medium');
      await loadIssues();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (isManagement) {
      Alert.prompt
        ? Alert.prompt(
            'Resolve Issue',
            'Enter resolution notes (optional):',
            async (notes) => {
              setResolving((prev) => ({ ...prev, [id]: true }));
              try {
                await updateIssue(id, { status: 'RESOLVED', resolutionNotes: notes || undefined });
                await loadIssues();
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to resolve.');
              } finally {
                setResolving((prev) => ({ ...prev, [id]: false }));
              }
            },
            'plain-text',
          )
        : handleResolveQuick(id);
    } else {
      handleResolveQuick(id);
    }
  };

  const handleResolveQuick = async (id: string) => {
    setResolving((prev) => ({ ...prev, [id]: true }));
    try {
      await updateIssue(id, { status: 'RESOLVED', resolutionNotes: 'Marked as resolved.' });
      await loadIssues();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resolve.');
    } finally {
      setResolving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleReopen = async (id: string) => {
    setResolving((prev) => ({ ...prev, [id]: true }));
    try {
      await updateIssue(id, { status: 'OPEN' });
      await loadIssues();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reopen.');
    } finally {
      setResolving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Issue', 'Are you sure you want to delete this issue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteIssue(id);
            await loadIssues();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const filteredIssues = issues;
  const openCount = issues.filter((i: any) => i.status === 'open').length;
  const resolvedCount = issues.filter((i: any) => i.status === 'resolved').length;

  return (
    <PageShell>
      <SectionTitle title={isManagement ? 'Issues Management' : 'My Issues'} />

      {/* Filter + New Issue */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', gap: Spacing.xs, flex: 1 }}>
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? colors.primary : colors.surface,
                  borderColor: filter === f ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: filter === f ? '#FFF' : colors.textSecondary }}>
                {f === 'all' ? `All (${issues.length})` : f === 'open' ? `Open (${openCount})` : `Resolved (${resolvedCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-outline" size={16} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Form */}
      {showForm && (
        <DataCard>
          <Text style={[styles.formTitle, { color: colors.text }]}>Submit Issue</Text>
          <Text style={[styles.label, { color: colors.textMuted }]}>Title *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
            placeholder="Brief title of the issue"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />
          <Text style={[styles.label, { color: colors.textMuted }]}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
            placeholder="Detailed description of the problem"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
           
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send-outline" size={16} color="#FFF" />}
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{submitting ? 'Submitting...' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </DataCard>
      )}

      {/* Issues List */}
      {loading ? (
        <DataCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading issues...</Text>
          </View>
        </DataCard>
      ) : filteredIssues.length === 0 ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
            {filter === 'all' ? 'No issues reported yet.' : `No ${filter} issues.`}
          </Text>
        </DataCard>
      ) : (
        filteredIssues.map((issue: any) => (
          <DataCard key={issue.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{issue.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                  {issue.description}
                </Text>
                <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[issue.status] || '#94A3B8') + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[issue.status] || '#94A3B8' }]} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: STATUS_COLORS[issue.status] || '#94A3B8' }}>
                      {issue.status}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (PRIORITY_COLORS[issue.priority] || '#94A3B8') + '20' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: PRIORITY_COLORS[issue.priority] || '#94A3B8' }}>
                      {issue.priority}
                    </Text>
                  </View>
                  {issue.category && (
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>· {issue.category}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                  {issue.submittedByName || 'Unknown'} · {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
                {issue.resolvedAt && (
                  <Text style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                    ✓ Resolved by {issue.resolvedByName || '—'} on {new Date(issue.resolvedAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
                {issue.resolutionNotes && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                    Note: {issue.resolutionNotes}
                  </Text>
                )}
              </View>
              {/* Actions */}
              <View style={{ gap: 4 }}>
                {isManagement && issue.status === 'OPEN' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => handleResolve(issue.id)}
                    disabled={resolving[issue.id]}
                  >
                    {resolving[issue.id] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-outline" size={16} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Resolve</Text>
                  </TouchableOpacity>
                )}
                {isManagement && issue.status === 'RESOLVED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => handleReopen(issue.id)}
                    disabled={resolving[issue.id]}
                  >
                    {resolving[issue.id] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="refresh-outline" size={16} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Reopen</Text>
                  </TouchableOpacity>
                )}
                {issue.status !== 'RESOLVED' && issue.submittedBy === user?.uid && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleDelete(issue.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </DataCard>
        ))
      )}

      <View style={{ height: 40 }} />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    paddingTop: Spacing.sm,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 2,
    minHeight: 42,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    minWidth: 70,
    justifyContent: 'center',
  },
});
