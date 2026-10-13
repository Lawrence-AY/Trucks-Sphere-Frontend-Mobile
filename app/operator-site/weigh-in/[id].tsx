import { useLocalSearchParams } from 'expo-router';
import SiteScheduleScreen from '../../../components/site/SiteScheduleScreen';

export default function SiteWeighInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SiteScheduleScreen key={id} jobId={id} />;
}
