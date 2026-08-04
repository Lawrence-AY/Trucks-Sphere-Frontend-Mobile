import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { MANAGEMENT_ROLES, normalizeRole } from '../../utils/access';

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
  const isManagement = role === MANAGEMENT_ROLES.SUPER_ADMIN;

  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'resolved'>('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [issueToResolve, setIssueToResolve] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

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
    if (isManagement) {
      return;
    }
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

  const openResolutionForm = (issue: any) => {
    setIssueToResolve(issue);
    setResolutionNotes(issue.resolutionNotes || '');
  };

  const closeResolutionForm = () => {
    if (issueToResolve && resolving[issueToResolve.id]) return;
    setIssueToResolve(null);
    setResolutionNotes('');
  };

  const handleResolve = async () => {
    const issueId = issueToResolve?.id;
    const notes = resolutionNotes.trim();
    if (!issueId) return;
    if (!notes) {
      Alert.alert('Resolution required', 'Enter the solution so the person who submitted this issue can see it.');
      return;
    }

    setResolving((prev) => ({ ...prev, [issueId]: true }));
    try {
      await updateIssue(issueId, { status: 'RESOLVED', resolutionNotes: notes });
      await loadIssues();
      setIssueToResolve(null);
      setResolutionNotes('');
      Alert.alert('Issue resolved', 'The resolution is now visible to the person who submitted the issue.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resolve.');
    } finally {
      setResolving((prev) => ({ ...prev, [issueId]: false }));
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
  const getIssueStatus = (issue: any) => String(issue.status || 'OPEN').toUpperCase();
  const resolvedCount = issues.filter((i: any) => String(i.status).toUpperCase() === 'RESOLVED').length;

  return (
    <>
    <PageShell>
      

      {/* Filter + New Issue */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', gap: Spacing.xs, flex: 1 }}>
          {(['all', 'resolved'] as const).map((f) => (
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
                {f === 'all' ? `All (${issues.length})` : `Resolved (${resolvedCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!isManagement && (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowForm(true)}
          >
            <Ionicons name="add-outline" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit Form */}
      {!isManagement && showForm && (
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
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[getIssueStatus(issue)] || '#94A3B8') + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[getIssueStatus(issue)] || '#94A3B8' }]} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: STATUS_COLORS[getIssueStatus(issue)] || '#94A3B8' }}>
                      {getIssueStatus(issue).replace(/_/g, ' ')}
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
                {(getIssueStatus(issue) === 'RESOLVED' || issue.resolutionNotes) && (
                  <View style={[styles.resolutionCard, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}35` }]}>
                    <View style={styles.resolutionHeader}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={[styles.resolutionTitle, { color: colors.success }]}>Resolution #{issue.issueNumber || issue.ticketNumber || String(issue.id || '').slice(-6).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.resolutionText, { color: colors.textSecondary }]}>
                      {issue.resolutionNotes || 'This issue has been resolved.'}
                    </Text>
                    {(issue.resolvedByName || issue.resolvedAt) && (
                      <Text style={[styles.resolutionMeta, { color: colors.textMuted }]}>
                        Resolved by {issue.resolvedByName || 'Super Admin'}{issue.resolvedAt ? ` on ${new Date(issue.resolvedAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}` : ''}
                      </Text>
                    )}
                  </View>
                )}
              </View>
              {/* Actions */}
              <View style={{ gap: 4 }}>
                {isManagement && getIssueStatus(issue) !== 'RESOLVED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => openResolutionForm(issue)}
                    disabled={resolving[issue.id]}
                  >
                    {resolving[issue.id] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-outline" size={16} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Resolve</Text>
                  </TouchableOpacity>
                )}
                {isManagement && getIssueStatus(issue) === 'RESOLVED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => handleReopen(issue.id)}
                    disabled={resolving[issue.id]}
                  >
                    {resolving[issue.id] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="refresh-outline" size={16} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Reopen</Text>
                  </TouchableOpacity>
                )}
                {getIssueStatus(issue) !== 'RESOLVED' && issue.submittedBy === user?.uid && (
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

    <Modal
        visible={Boolean(issueToResolve)}
        transparent
        animationType="fade"
        onRequestClose={closeResolutionForm}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.resolutionDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogTitle, { color: colors.text }]}>Resolve issue</Text>
                <Text style={[styles.dialogSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                  Add the solution that will be shown to the person who reported “{issueToResolve?.title}”.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close resolution form"
                style={[styles.closeButton, { backgroundColor: colors.inputBg }]}
                onPress={closeResolutionForm}
                disabled={Boolean(issueToResolve && resolving[issueToResolve.id])}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Resolution *</Text>
            <TextInput
              style={[styles.input, styles.resolutionInput, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Describe how this issue was resolved"
              placeholderTextColor={colors.textTertiary}
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!Boolean(issueToResolve && resolving[issueToResolve.id])}
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={closeResolutionForm}
                disabled={Boolean(issueToResolve && resolving[issueToResolve.id])}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.success, opacity: issueToResolve && resolving[issueToResolve.id] ? 0.6 : 1 }]}
                onPress={handleResolve}
                disabled={Boolean(issueToResolve && resolving[issueToResolve.id])}
              >
                {issueToResolve && resolving[issueToResolve.id] ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-outline" size={17} color="#FFF" />}
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Mark resolved</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    </Modal>
    </>
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
  resolutionCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resolutionTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  resolutionText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.xs,
  },
  resolutionMeta: {
    fontSize: 11,
    marginTop: Spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  resolutionDialog: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  dialogSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolutionInput: {
    minHeight: 112,
    paddingTop: Spacing.sm,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
