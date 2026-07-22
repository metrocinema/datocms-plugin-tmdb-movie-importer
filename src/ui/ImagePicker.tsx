import type { NormalizedImageCandidate } from '../domain/movie';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selectedIds: string[];
  onToggle: (providerImageId: string) => void;
};

export function ImagePicker({ images, selectedIds, onToggle }: ImagePickerProps) {
  return (
    <div>
      {images.map((image) => (
        <label key={`${image.providerKey}:${image.providerImageId}`}>
          <input type="checkbox" checked={selectedIds.includes(image.providerImageId)} onChange={() => onToggle(image.providerImageId)} />
          <img src={image.originalUrl} alt={`${image.type} candidate`} width={120} />
        </label>
      ))}
    </div>
  );
}
