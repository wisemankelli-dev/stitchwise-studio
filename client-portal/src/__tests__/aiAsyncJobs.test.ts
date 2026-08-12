/**
 * Tests for the async AI job pattern (202 { jobId } + polling) in the client
 * API layer:
 * - generateCollageFromText: polls GET /api/ai/jobs/:id and normalizes the result
 * - generateArt: polls the job and returns { imageDataUrl, pipeline }
 * - submitAndPollAIJob: retries the submission once when the first job errors,
 *   then surfaces the error if the retry also fails
 *
 * These mirror the backend aiJobs tests — together they cover the full
 * request path that survives the platform gateway's ~30s upstream timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../services/api';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('async AI job pattern (202 + polling)', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    api.isLiveBackend = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('generateCollageFromText polls a 202 job and normalizes the result', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }, 202)) // POST
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1', status: 'processing' })) // poll 1
      .mockResolvedValueOnce(
        jsonResponse({
          jobId: 'job-1',
          status: 'done',
          result: {
            success: true,
            data: {
              layers: [
                { id: 'bg', name: 'Base Fabric', color: '#ffffff', pattern: 'solid', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 0 },
              ],
              referenceImage: 'data:image/png;base64,ART',
              canvasWidth: 500,
              canvasHeight: 500,
              processingTimeMs: 42,
            },
          },
        }),
      ); // poll 2 → done

    const promise = api.generateCollageFromText('small red rose');
    await vi.advanceTimersByTimeAsync(2000); // poll 1
    await vi.advanceTimersByTimeAsync(2000); // poll 2
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/ai/collage/text-to-collage');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/ai/jobs/job-1');
    expect(result.success).toBe(true);
    expect(result.layers).toHaveLength(1);
    expect(result.referenceArt).toBe('data:image/png;base64,ART');
    expect(result.totalLayers).toBe(1);
    expect(result.promptUsed).toBe('small red rose');
  });

  it('generateArt polls a 202 job and returns the image data URL', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'art-1' }, 202))
      .mockResolvedValueOnce(
        jsonResponse({ jobId: 'art-1', status: 'done', result: { imageDataUrl: 'data:image/png;base64,XYZ', pipeline: 'dall-e' } }),
      );

    const promise = api.generateArt('butterfly');
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/ai/generate-art');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/ai/jobs/art-1');
    expect(result.imageDataUrl).toBe('data:image/png;base64,XYZ');
    expect(result.pipeline).toBe('dall-e');
  });

  it('retries the submission once when the first job errors, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail' }, 202)) // submit 1
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail', status: 'error', error: 'boom' })) // poll 1 → error
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-ok' }, 202)) // submit 2 (retry)
      .mockResolvedValueOnce(
        jsonResponse({ jobId: 'job-ok', status: 'done', result: { success: true, data: { layers: [], canvasWidth: 500, canvasHeight: 500 } } }),
      ); // poll 2 → done

    const promise = api.generateCollageFromText('heart');
    await vi.advanceTimersByTimeAsync(2000); // poll 1 → error, triggers retry POST
    await vi.advanceTimersByTimeAsync(2000); // poll 2 → done
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws the last error when both attempts fail', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail' }, 202))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail', status: 'error', error: 'boom' }))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail2' }, 202))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-fail2', status: 'error', error: 'boom again' }));

    const promise = api.generateCollageFromText('sun');
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).rejects.toThrow('boom again');
  });
});
