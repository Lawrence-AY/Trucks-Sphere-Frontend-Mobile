import ManagementResourceScreen from '../../components/ManagementResourceScreen';
import { fetchDeliveryOrders } from '../../services/api';

export default function DispatchQueueScreen() {
  return (
    <ManagementResourceScreen
      eyebrow="Operations"
      title="Dispatch Queue"
      subtitle="Jobs waiting for assignment, loading, or quarry movement."
      icon="git-branch-outline"
      searchPlaceholder="Search job, vendor, driver, status..."
      fetcher={async () => {
        const jobs = await fetchDeliveryOrders();
        return jobs.filter((job) => !['in_transit', 'completed', 'cancelled'].includes(job.status));
      }}
      getTitle={(item) => item.jobId || item.id}
      getSubtitle={(item) => item.vendorName || item.materialName || item.status || 'Queued job'}
      getDetails={(item) => [
        { icon: 'document-text-outline', label: 'PO', value: item.purchaseOrderId || item.purchaseOrderNumber || 'Not linked' },
        { icon: 'cube-outline', label: 'Material', value: item.materialName || item.material || 'Not set' },
      ]}
      emptyTitle="No dispatch jobs found"
    />
  );
}
