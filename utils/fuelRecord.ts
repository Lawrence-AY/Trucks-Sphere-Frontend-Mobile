export function getFuelAttendantName(record: any): string {
  const name = [record?.dispensedByName, record?.attendantName, record?.dispensedBy]
    .map((value) => String(value || '').trim())
    .find((value) => value && value.toLowerCase() !== 'fuel operator');
  return name || 'Fuel Operator';
}

export function getFuelAuthorizationCode(record: any): string {
  return String(record?.authorizationCode || record?.authorizationId || '').trim();
}
