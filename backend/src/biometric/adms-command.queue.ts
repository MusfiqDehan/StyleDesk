import { commitBeforeDeviceMutation, tenantStorage } from '../tenancy/tenant-context.js';
import { DeviceState } from '../tenancy/device-state.js';
import { Injectable, Logger } from '@nestjs/common';

export interface AdmsQueuedCommand {
  id: number;
  sn: string;
  body: string;
  createdAt: number;
}

type AckWaiter = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * In-memory queue of ADMS commands for ZKTeco devices.
 * Devices poll GET /iclock/getrequest and receive:
 *   C:{id}:{command text}
 * Enrollment sends DELETE (optional) + USERINFO + ENROLL_FP in one response
 * so the terminal opens the fingerprint UI on the same poll cycle.
 */
@Injectable()
@DeviceState()
export class AdmsCommandQueue {
  private readonly logger = new Logger(AdmsCommandQueue.name);
  private static readonly IN_FLIGHT_TIMEOUT_MS = 45_000;
  private static readonly DEFAULT_ACK_TIMEOUT_MS = 45_000;

  private nextId = 1;
  private readonly bySerial = new Map<string, AdmsQueuedCommand[]>();
  private readonly inFlight = new Map<string, AdmsQueuedCommand[]>();
  private readonly ackWaiters = new Map<number, AckWaiter>();

  /**
   * Queue a command and wait until the device ACKs it via POST /iclock/devicecmd.
   * Rejects on non-zero Return, timeout, or device offline.
   */
  async enqueueAndAwait(
    sn: string,
    commandBody: string,
    timeoutMs = AdmsCommandQueue.DEFAULT_ACK_TIMEOUT_MS,
  ): Promise<void> {
    if (tenantStorage.getStore()) await commitBeforeDeviceMutation();
    const cmd = this.enqueue(sn, commandBody);
    return this.waitForCommandAck(cmd, timeoutMs);
  }

  waitForCommandAck(
    cmd: AdmsQueuedCommand,
    timeoutMs = AdmsCommandQueue.DEFAULT_ACK_TIMEOUT_MS,
  ): Promise<void> {
    const existing = this.ackWaiters.get(cmd.id);
    if (existing) {
      clearTimeout(existing.timer);
      this.ackWaiters.delete(cmd.id);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ackWaiters.delete(cmd.id);
        reject(
          new Error(
            `ZKTeco did not confirm the command within ${Math.round(timeoutMs / 1000)}s. ` +
              'Check that the device is online and connected via ADMS.',
          ),
        );
      }, timeoutMs);

      this.ackWaiters.set(cmd.id, { resolve, reject, timer });
    });
  }

  enqueue(sn: string, commandBody: string): AdmsQueuedCommand {
    const serial = this.normalizeSn(sn);
    const cmd: AdmsQueuedCommand = {
      id: this.nextId++,
      sn: serial,
      body: commandBody.trim(),
      createdAt: Date.now(),
    };
    const list = this.bySerial.get(serial) ?? [];
    list.push(cmd);
    this.bySerial.set(serial, list);
    this.logger.log(`Queued ADMS cmd #${cmd.id} for SN=${serial}: ${cmd.body}`);
    return cmd;
  }

  enqueueBatch(sn: string, commandBodies: string[]): AdmsQueuedCommand[] {
    return commandBodies.map((body) => this.enqueue(sn, body));
  }

  /**
   * Drop any stuck in-flight cmds and insert this batch at the front of the queue
   * so the next getrequest returns enrollment immediately.
   */
  enqueueEnrollmentPriority(sn: string, commandBodies: string[]): AdmsQueuedCommand[] {
    const serial = this.normalizeSn(sn);
    if (this.inFlight.has(serial)) {
      const dropped = this.inFlight.get(serial) ?? [];
      this.inFlight.delete(serial);
      if (dropped.length > 0) {
        this.logger.warn(
          `Cleared in-flight cmds for SN=${serial} to prioritize enrollment: [${dropped.map((c) => `#${c.id}`).join(',')}]`,
        );
      }
    }

    const cmds = commandBodies.map((body) => {
      const cmd: AdmsQueuedCommand = {
        id: this.nextId++,
        sn: serial,
        body: body.trim(),
        createdAt: Date.now(),
      };
      this.logger.log(`Priority-queued ADMS cmd #${cmd.id} for SN=${serial}: ${cmd.body}`);
      return cmd;
    });

    const existing = this.bySerial.get(serial) ?? [];
    this.bySerial.set(serial, [...cmds, ...existing]);
    return cmds;
  }

  /**
   * Return pending command line(s) for getrequest, or null if none.
   */
  dequeueForDevice(sn: string): string | null {
    const serial = this.normalizeSn(sn);
    if (!serial) return null;

    this.expireStaleInFlight(serial);

    const flying = this.inFlight.get(serial);
    if (flying && flying.length > 0) {
      return this.formatCommands(flying);
    }

    const list = this.bySerial.get(serial);
    if (!list || list.length === 0) return null;

    const batch: AdmsQueuedCommand[] = [list.shift()!];

    // Pull enrollment-related follow-ups into the same response.
    while (list.length > 0 && batch.length < 3 && this.canAppendEnrollmentStep(batch, list[0])) {
      batch.push(list.shift()!);
    }

    this.inFlight.set(serial, batch);
    this.logger.log(
      `Dispatching ADMS cmd(s) [${batch.map((c) => `#${c.id}`).join(',')}] to SN=${serial}`,
    );
    return this.formatCommands(batch);
  }

  acknowledge(sn: string, rawBody: string): void {
    const serial = this.normalizeSn(sn);
    const flying = this.inFlight.get(serial);
    if (!flying || flying.length === 0) {
      this.logger.debug(`ADMS ACK with no in-flight cmds SN=${serial}`);
      return;
    }

    const idMatches = [...rawBody.matchAll(/(?:^|[&\s\n])ID=(\d+)/gi)];
    const ackedIds = new Set(idMatches.map((m) => Number(m[1])));

    if (ackedIds.size === 0) {
      for (const cmd of flying) {
        this.logger.log(`ADMS cmd #${cmd.id} SN=${serial} ACK (no ID in body)`);
        this.resolveAckWaiter(cmd.id, 0);
      }
      this.inFlight.delete(serial);
      return;
    }

    const remaining = flying.filter((cmd) => {
      if (!ackedIds.has(cmd.id)) return true;
      const retMatch = rawBody.match(
        new RegExp(`(?:^|[&\\s\\n])ID=${cmd.id}(?:&|\\s)[^\\n]*?Return=(-?\\d+)`, 'i'),
      );
      const ret = retMatch ? Number(retMatch[1]) : 0;
      if (ret !== 0) {
        this.logger.warn(`ADMS cmd #${cmd.id} SN=${serial} returned ${ret}: ${cmd.body}`);
      } else {
        this.logger.log(`ADMS cmd #${cmd.id} SN=${serial} ACK OK`);
      }
      this.resolveAckWaiter(cmd.id, ret);
      return false;
    });

    if (remaining.length === 0) {
      this.inFlight.delete(serial);
    } else {
      this.inFlight.set(serial, remaining);
    }
  }

  pendingCount(sn?: string): number {
    if (!sn) {
      let total = 0;
      for (const list of this.bySerial.values()) total += list.length;
      for (const list of this.inFlight.values()) total += list.length;
      return total;
    }
    const serial = this.normalizeSn(sn);
    return (this.bySerial.get(serial)?.length ?? 0) + (this.inFlight.get(serial)?.length ?? 0);
  }

  normalizeSn(sn: string): string {
    return (sn || '').trim().toUpperCase();
  }

  private formatCommands(cmds: AdmsQueuedCommand[]): string {
    // CRLF is more compatible with older ZKTeco ADMS firmwares.
    return cmds.map((cmd) => `C:${cmd.id}:${cmd.body}`).join('\r\n');
  }

  private expireStaleInFlight(serial: string): void {
    const flying = this.inFlight.get(serial);
    if (!flying || flying.length === 0) return;
    const oldest = Math.min(...flying.map((c) => c.createdAt));
    if (Date.now() - oldest < AdmsCommandQueue.IN_FLIGHT_TIMEOUT_MS) return;

    this.logger.warn(
      `Clearing stale in-flight ADMS cmd(s) for SN=${serial}: [${flying.map((c) => `#${c.id}`).join(',')}]`,
    );
    this.inFlight.delete(serial);
  }

  private canAppendEnrollmentStep(
    batch: AdmsQueuedCommand[],
    next: AdmsQueuedCommand,
  ): boolean {
    const last = batch[batch.length - 1];
    if (!last) return false;

    // DELETE → USERINFO (re-register)
    if (this.isDeleteUserCommand(last.body) && this.isUserInfoCommand(next.body)) {
      return true;
    }

    // DELETE FINGERTMP → ENROLL_FP (re-enroll on same PIN)
    if (this.isDeleteFingerprintCommand(last.body) && this.isEnrollFpCommand(next.body)) {
      const pinA = this.extractPin(last.body);
      const pinB = this.extractPin(next.body);
      return Boolean(pinA && pinB && pinA === pinB);
    }

    // USERINFO → ENROLL_FP (same PIN)
    if (this.isUserInfoCommand(last.body) && this.isEnrollFpCommand(next.body)) {
      const pinA = this.extractPin(last.body);
      const pinB = this.extractPin(next.body);
      return Boolean(pinA && pinB && pinA === pinB);
    }

    return false;
  }

  private resolveAckWaiter(commandId: number, returnCode: number): void {
    const waiter = this.ackWaiters.get(commandId);
    if (!waiter) return;

    clearTimeout(waiter.timer);
    this.ackWaiters.delete(commandId);

    if (returnCode !== 0) {
      waiter.reject(
        new Error(`ZKTeco rejected the command (Return=${returnCode}). Try again when the device is ready.`),
      );
      return;
    }

    waiter.resolve();
  }

  private isDeleteUserCommand(body: string): boolean {
    return /DATA\s+DELETE\s+USERINFO/i.test(body);
  }

  private isDeleteFingerprintCommand(body: string): boolean {
    return /(?:DATA\s+)?DELETE\s+FINGERTMP/i.test(body);
  }

  private isUserInfoCommand(body: string): boolean {
    return /DATA\s+UPDATE\s+USERINFO/i.test(body);
  }

  private isEnrollFpCommand(body: string): boolean {
    return /ENROLL_FP\b/i.test(body);
  }

  private extractPin(body: string): string | null {
    const match = body.match(/(?:^|\s|\t)PIN=(\S+)/i);
    return match?.[1]?.trim() ?? null;
  }
}
