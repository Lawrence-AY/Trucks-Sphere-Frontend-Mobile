// Ephemeral hand-off for the Inspector detail route. It avoids a second
// delivery-list request before the selected inspection form can render.
let selectedJob: any = null;

export function setInspectorSelection(job: any): void { selectedJob = job; }
export function getInspectorSelection(id?: string): any | null {
  if (!selectedJob) return null;
  return !id || selectedJob.id === id || selectedJob.jobId === id ? selectedJob : null;
}
export function clearInspectorSelection(): void { selectedJob = null; }
