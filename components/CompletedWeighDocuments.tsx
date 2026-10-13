import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export function CompletedWeighDocuments({ job, site = false }: { job: any; site?: boolean }) {
  const colors = useTheme();
  if (!job) return null;
  const id = encodeURIComponent(job.jobId || job.id);
  return <View style={{ padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, gap: 12 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>Weigh-out complete · {job.jobId || job.id}</Text>
    <Link href={`/screens/delivery-note?id=${id}` as any} style={{ color: colors.primaryText, paddingVertical: 8 }}>Open delivery note</Link>
    {site && <Link href={`/screens/receipt-note?id=${id}` as any} style={{ color: colors.primaryText, paddingVertical: 8 }}>Open receipt note</Link>}
  </View>;
}
