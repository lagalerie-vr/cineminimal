export function getImageUrl(path: string | null, size: string = 'original') {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Poster';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
