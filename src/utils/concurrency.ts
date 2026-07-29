export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>,
  onSuccess?: (result: R, value: T, index: number) => void,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let failed = false;
  let firstError: unknown;

  const worker = async () => {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) {
        return;
      }

      try {
        const result = await operation(values[index], index);
        results[index] = result;
        onSuccess?.(result, values[index], index);
      } catch (error) {
        failed = true;
        firstError = error;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      () => worker(),
    ),
  );

  if (failed) {
    throw firstError;
  }

  return results;
}
