export type RecordColumn = { key: string; label: string; value: (record: any) => string | number };
export type DesktopRecordsProps = {
  title: string;
  description?: string;
  records: any[];
  columns: RecordColumn[];
  search: string;
  onSearch: (value: string) => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
  recordHref?: (record: any) => string;
  createHref?: string;
  createLabel?: string;
};
// Native screens keep their existing list presentation.
export default function DesktopRecords(_props: DesktopRecordsProps) { return null; }
