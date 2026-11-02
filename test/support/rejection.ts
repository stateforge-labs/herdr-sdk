// Role: returns the error a promise rejects with, so a test can assert on it; fails the test when the promise resolves.
// Informs plan 5 (socket tests assert on typed errors); new test helper.

export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the promise to reject');
}
