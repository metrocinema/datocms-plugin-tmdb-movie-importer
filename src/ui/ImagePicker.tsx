import type { NormalizedImageCandidate } from '../domain/movie';

type ImagePickerProps = {
  images: NormalizedImageCandidate[];
  selectedIds: string[];
  onToggle: (providerImageId: string) => void;
};

export function ImagePicker({ images, selectedIds, onToggle }: ImagePickerProps) {
  const posters = images.filter((image) => image.type === 'poster');
  const backdrops = images.filter((image) => image.type === 'backdrop');
  const heroBackdropId = selectedIds.find((providerImageId) => backdrops.some((image) => image.providerImageId === providerImageId));

  const imageOptions = (candidates: NormalizedImageCandidate[]) => candidates.map((image) => (
    <label key={`${image.providerKey}:${image.providerImageId}`}>
      <input type="checkbox" checked={selectedIds.includes(image.providerImageId)} onChange={() => onToggle(image.providerImageId)} />
      <img src={image.originalUrl} alt={`${image.type} candidate`} width={120} />
      {image.providerImageId === heroBackdropId ? <span>Hero image selection</span> : null}
    </label>
  ));

  return (
    <div>
      <h4>Poster</h4>
      {imageOptions(posters)}
      <h4>Hero image</h4>
      <h4>Other images</h4>
      <p>The first selected backdrop becomes the Hero image. All selected backdrops are added to Other images.</p>
      {imageOptions(backdrops)}
    </div>
  );
}
