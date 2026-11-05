import OperatorSiteProfileScreen from '../operator-site/profile';

// Storekeepers share the account design and controls used by operational users,
// while displaying store-specific identity information.
export default function StorekeeperProfileScreen() {
  return <OperatorSiteProfileScreen accountType="storekeeper" />;
}
