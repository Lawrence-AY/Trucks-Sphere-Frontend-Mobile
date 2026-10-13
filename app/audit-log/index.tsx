import { Redirect } from 'expo-router';

/** Keep old deep links valid without exposing the retired audit-log screen. */
export default function AuditLogRedirect() {
  return <Redirect href="/management/dashboard" />;
}
