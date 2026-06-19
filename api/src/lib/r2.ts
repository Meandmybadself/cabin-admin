export function r2KeyForPhoto(takenAt: number, categoryId: string, id: string): string {
  const date = new Date(takenAt * 1000).toISOString().slice(0, 10);
  return `photos/${date}/${categoryId}/${id}`;
}
