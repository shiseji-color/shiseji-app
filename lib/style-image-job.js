export async function runStyleImageJob({
  claim,
  generate,
  complete,
  fail,
}) {
  const job = await claim();
  if (job.status === 'completed') {
    return { status: 'completed', resultUrl: job.resultUrl, reused: true };
  }
  if (job.status === 'processing') {
    return { status: 'processing', resultUrl: null, reused: false };
  }
  if (job.status !== 'claimed') throw new Error('Unexpected style image job status');

  let resultUrl;
  try {
    resultUrl = await generate();
  } catch (error) {
    if (error?.retryGeneration === true) await fail();
    throw error;
  }

  // Once the paid model has returned, a persistence/network failure must leave
  // the job locked in processing. Automatically releasing it could pay twice.
  await complete(resultUrl);
  return { status: 'completed', resultUrl, reused: false };
}
