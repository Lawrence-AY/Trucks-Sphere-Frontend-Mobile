import { useScreenSearchHeader } from './useScreenSearchHeader';

export function useQuarrySearchHeader(title: string, search: string, onChange: (value: string) => void, editing: boolean) {
  return useScreenSearchHeader({
    title, search, onChangeSearch: onChange,
    placeholder: 'Search job, driver, plate...',
    icon: title === 'Weigh In' ? 'download-outline' : 'arrow-up-outline',
    hideSearch: editing,
  });
}
