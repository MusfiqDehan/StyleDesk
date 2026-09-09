import { AdmsCommandQueue } from './adms-command.queue';

describe('AdmsCommandQueue enrollment batching', () => {
  it('delivers USERINFO + ENROLL_FP together on one getrequest', () => {
    const queue = new AdmsCommandQueue();
    queue.enqueueEnrollmentPriority('abc123', [
      'DATA UPDATE USERINFO PIN=5\tName=Test\tPrivilege=0\tCard=\tGrp=0',
      'ENROLL_FP PIN=5\tFID=0\tRETRY=3\tOVERWRITE=1',
    ]);

    const payload = queue.dequeueForDevice('ABC123');
    expect(payload).toContain('DATA UPDATE USERINFO PIN=5');
    expect(payload).toContain('ENROLL_FP PIN=5');
    expect(payload?.split(/\r?\n/).filter(Boolean)).toHaveLength(2);
  });

  it('priority enrollment jumps ahead of older queued commands', () => {
    const queue = new AdmsCommandQueue();
    queue.enqueue('SN1', 'INFO');
    queue.enqueueEnrollmentPriority('SN1', [
      'DATA UPDATE USERINFO PIN=4\tName=Riya\tPrivilege=0\tCard=\tGrp=0',
      'ENROLL_FP PIN=4\tFID=0\tRETRY=3\tOVERWRITE=1',
    ]);

    const payload = queue.dequeueForDevice('sn1');
    const lines = payload?.split(/\r?\n/).filter(Boolean) ?? [];
    expect(lines[0]).toContain('DATA UPDATE USERINFO PIN=4');
    expect(lines[1]).toContain('ENROLL_FP PIN=4');
  });

  it('delivers DELETE + USERINFO + ENROLL_FP together for re-register', () => {
    const queue = new AdmsCommandQueue();
    queue.enqueueEnrollmentPriority('SN1', [
      'DATA DELETE USERINFO PIN=3',
      'DATA UPDATE USERINFO PIN=4\tName=Riya\tPrivilege=0\tCard=\tGrp=0',
      'ENROLL_FP PIN=4\tFID=0\tRETRY=3\tOVERWRITE=1',
    ]);

    const payload = queue.dequeueForDevice('sn1');
    const lines = payload?.split(/\r?\n/).filter(Boolean) ?? [];
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('DATA DELETE USERINFO PIN=3');
    expect(lines[1]).toContain('DATA UPDATE USERINFO PIN=4');
    expect(lines[2]).toContain('ENROLL_FP PIN=4');
  });

  it('delivers DELETE FINGERTMP + ENROLL_FP together for same-PIN re-enroll', () => {
    const queue = new AdmsCommandQueue();
    queue.enqueueEnrollmentPriority('SN1', [
      'DATA DELETE FINGERTMP PIN=7',
      'ENROLL_FP PIN=7\tFID=0\tRETRY=3\tOVERWRITE=1',
    ]);

    const payload = queue.dequeueForDevice('sn1');
    const lines = payload?.split(/\r?\n/).filter(Boolean) ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('DATA DELETE FINGERTMP PIN=7');
    expect(lines[1]).toContain('ENROLL_FP PIN=7');
  });

  it('enqueueAndAwait resolves when devicecmd ACKs with Return=0', async () => {
    const queue = new AdmsCommandQueue();
    const wait = queue.enqueueAndAwait('SN2', 'DATA DELETE FINGERTMP PIN=3', 5000);

    const payload = queue.dequeueForDevice('SN2');
    expect(payload).toContain('DATA DELETE FINGERTMP PIN=3');

    const idMatch = payload?.match(/C:(\d+):/);
    expect(idMatch).toBeTruthy();
    queue.acknowledge('SN2', `ID=${idMatch![1]}&Return=0&CMD=DATA`);

    await expect(wait).resolves.toBeUndefined();
  });

  it('enqueueAndAwait rejects when devicecmd ACKs with non-zero Return', async () => {
    const queue = new AdmsCommandQueue();
    const wait = queue.enqueueAndAwait('SN3', 'DATA DELETE USERINFO PIN=9', 5000);

    const payload = queue.dequeueForDevice('SN3');
    const idMatch = payload?.match(/C:(\d+):/);
    queue.acknowledge('SN3', `ID=${idMatch![1]}&Return=-1&CMD=DATA`);

    await expect(wait).rejects.toThrow(/rejected the command/i);
  });
});
