import { Redirect } from 'expo-router';

/** Retire legacy audit-log detail deep links. */
export default function AuditLogDetailRedirect() {
  return <Redirect href="/management/dashboard" />;
}
