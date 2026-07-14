import ManagementResourceScreen from '../../components/ManagementResourceScreen';
import { fetchReports } from '../../services/api';

export default function ReportsScreen() {
  return (
    <ManagementResourceScreen
      eyebrow="Intelligence"
      title="Reports"
      subtitle="Operational report catalog backed by live TruckSphere data."
      icon="bar-chart-outline"
      searchPlaceholder="Search report, category..."
      fetcher={fetchReports}
      getSubtitle={(item) => item.description || item.category || 'Report'}
      getDetails={(item) => [
        { icon: 'folder-outline', label: 'Category', value: item.category || 'General' },
        { icon: 'server-outline', label: 'Records', value: String(item.recordCount || 0) },
      ]}
      emptyTitle="No reports found"
    />
  );
}
