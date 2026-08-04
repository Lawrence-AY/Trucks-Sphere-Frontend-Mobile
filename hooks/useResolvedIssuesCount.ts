import { useEffect, useState } from 'react';
import { fetchIssues } from '../services/api';

/** Count the signed-in user's resolved issues for the Issues navigation badge. */
export function useResolvedIssuesCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const issues = await fetchIssues({ status: 'resolved' });
        if (active) setCount(issues.length);
      } catch {
        if (active) setCount(0);
      }
    };

    void load();
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return count;
}
