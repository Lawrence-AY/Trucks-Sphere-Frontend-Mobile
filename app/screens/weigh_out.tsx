import { Redirect } from 'expo-router';

/** Legacy deep link retained only to guide users to the supported workflow. */
export default function LegacyWeighOutRedirect() {
  return <Redirect href="/operator-quarry/weigh-out" />;
}
