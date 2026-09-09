import { commitBeforeDeviceMutation, requireScope } from '../tenancy/tenant-context.js';
import { DeviceState } from '../tenancy/device-state.js';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ZKLib, { ZKUser, ZKAttendance } from 'node-zklib';

interface ZKLibInstance extends ZKLib {
  zklibTcp?: { socket?: { removeAllListeners: () => void; destroy: () => void } };
  socket?: { removeAllListeners: () => void; destroy: () => void };
}

const RECONNECT_DELAY_MS = 15_000;
const INITIAL_CONNECT_DELAY_MS = 10_000;
const CONNECTION_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 10_000; // Timeout for most device commands
const ATTENDANCE_FETCH_TIMEOUT_MS = 60_000; // Attendance fetch needs time for large logs on F18
const POST_CONNECT_DELAY_MS = 1_000; // Wait 1s after connecting before first operations
const POLLING_INTERVAL_MS = 35_000; // Poll device every 35 seconds to avoid collision with 30s attendance cron
const MAX_BENIGN_ERRORS_BEFORE_RECONNECT = 5; // Force reconnect after 5 consecutive benign errors

type FingerprintEventHandler = () => void | Promise<void>;

@Injectable()
@DeviceState()
export class ZKTecoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZKTecoService.name);

  private zk: ZKLib | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private pollingStartTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private connecting = false;

  private readonly fingerprintHandlers = new Set<FingerprintEventHandler>();
  private lastUserCount = 0;
  private pendingUserCount: number | null = null;
  private pendingUserCountHits = 0;
  private usersFetchPromise: Promise<ZKUser[]> | null = null;
  private deviceOperationQueue: Promise<void> = Promise.resolve();
  private deviceSessionVersion = 0;
  private consecutiveBenignErrors = 0; // Track transport errors for progressive recovery

  private ip: string;
  private port: number;
  private enabled: boolean;

  // Cloud (ADMS) connectivity tracking
  private lastCloudContactAt: Date | null = null;
  private cloudSn: string | null = null;
  private static readonly CLOUD_CONNECTED_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  /** Allow queuing enroll/delete commands a bit longer than the UI "Connected" badge. */
  private static readonly CLOUD_COMMAND_SN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  constructor(config: ConfigService) {
    this.ip = '';
    this.port = 4370;
    this.enabled = false;
  }

  onModuleInit(): void {
    // Device work runs with a registered tenant/device scope.
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pollingStartTimer) {
      clearTimeout(this.pollingStartTimer);
      this.pollingStartTimer = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.safeDisconnect();
  }

  subscribeToFingerprintEvents(handler: FingerprintEventHandler): () => void {
    this.fingerprintHandlers.add(handler);
    return () => {
      this.fingerprintHandlers.delete(handler);
    };
  }

  async connect(): Promise<void> {
    const scope = requireScope();
    if (!scope.deviceId) return;
    const [device] = await scope.runner.query('SELECT host,port FROM registered_device WHERE id=$1 AND active', [scope.deviceId]);
    if (!device?.host) { this.enabled = false; if (this.connected) this.safeDisconnect(); return; }
    if (this.connected && (this.ip !== device.host || this.port !== device.port)) this.safeDisconnect();
    this.ip = device.host; this.port = device.port; this.enabled = true;
    if (this.destroyed || this.connected || this.connecting) return;

    this.logger.log(`Connecting to ZKTeco device at ${this.ip}:${this.port}...`);
    this.connecting = true;
    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        this.zk = new ZKLib(this.ip, this.port, CONNECTION_TIMEOUT_MS, 0);
        this.deviceSessionVersion += 1;
        this.consecutiveBenignErrors = 0; // Reset before each attempt so a fresh connect clears the error streak

        try {
          await this.zk.createSocket();
          this.connected = true;
          this.logger.log(`Connected to ZKTeco device at ${this.ip}:${this.port}`);

          // Wait a moment for device to be ready before operations
          await new Promise((resolve) => setTimeout(resolve, POST_CONNECT_DELAY_MS));

          this.startRealTimeMonitoring();
          return;
        } catch (err: unknown) {
          const failedInstance = this.zk;
          this.connected = false;
          this.zk = null;
          if (failedInstance) this.destroyZkInstance(failedInstance);

          if (attempt < 2) {
            this.logger.warn(
              `ZKTeco connect attempt ${attempt} failed, retrying once: ${this.formatError(err)}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          throw err;
        }
      }
    } catch (err: unknown) {
      const msg = this.formatError(err);
      this.logger.warn(`Failed to connect to ZKTeco device: ${msg}`);
      const failedInstance = this.zk;
      this.connected = false;
      this.zk = null;
      if (failedInstance) this.destroyZkInstance(failedInstance);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private startRealTimeMonitoring(): void {
    if (!this.zk) return;
    // NOTE: getRealTimeLogs() registers a persistent 'data' listener on the socket which
    // conflicts with request/response operations (getUsers, getAttendances). This causes
    // ERR_STREAM_WRITE_AFTER_END errors. Disabled for now; polling alone is sufficient.
    // 
    // try {
    //   await this.zk.getRealTimeLogs(() => {
    //     // Debounce: batch rapid events into a single check
    //     if (this.debounceTimer) clearTimeout(this.debounceTimer);
    //     this.debounceTimer = setTimeout(() => {
    //       this.debounceTimer = null;
    //       this.notifyFingerprintHandlers();
    //     }, DEBOUNCE_MS);
    //   });
    //   this.logger.log('Real-time fingerprint monitoring started');
    // } catch (err: unknown) {
    //   const msg = err instanceof Error ? err.message : String(err);
    //   this.logger.warn(`Could not start real-time monitoring: ${msg}`);
    // }

    // Fallback: use polling to detect users added directly on device (not via fingerprint)
    this.logger.log('Using polling only (real-time monitoring disabled due to socket conflicts)');
    this.startPolling();
  }

  private startPolling(): void {
    // Reconnect/poll through tenant-scoped scheduled work.
  }

  private async pollDeviceForNewUsers(): Promise<void> {
    try {
      const users = await this.getUsers();

      // If the device is offline, getUsers() returns [] and sets connected=false.
      // Treat this as a non-event so we don't trigger a sync with an empty user list,
      // which would cause the sync service to mark all linked users as deleted.
      if (!this.connected && users.length === 0) {
        return;
      }

      // Guard against transient spikes from device/library by requiring two
      // consecutive polls to report the same changed count before syncing.
      const normalizedCount = new Set(users.map((u) => String(u.userId))).size;

      // Hard guard: never trigger a mass-deletion sync when the device returns an
      // empty user list but previously reported users. This protects against
      // transient ZKTeco device / node-zklib glitches that return [] for one or
      // two polls even though users are still enrolled. Triggering syncWithDevice()
      // with an empty set would mark every linked device user as DELETED.
      if (normalizedCount === 0 && this.lastUserCount > 0) {
        this.logger.warn(
          `Polling: device returned 0 users but previously had ${this.lastUserCount} — ` +
          `skipping sync to prevent accidental mass-deletion of linked fingerprints`,
        );
        this.pendingUserCount = null;
        this.pendingUserCountHits = 0;
        return;
      }

      if (normalizedCount !== this.lastUserCount) {
        if (this.pendingUserCount !== normalizedCount) {
          this.pendingUserCount = normalizedCount;
          this.pendingUserCountHits = 1;
          return;
        }

        this.pendingUserCountHits += 1;
        if (this.pendingUserCountHits < 2) {
          return;
        }

        this.logger.log(
          `User count changed: ${this.lastUserCount} → ${normalizedCount} (triggering sync)`,
        );
        this.lastUserCount = normalizedCount;
        this.pendingUserCount = null;
        this.pendingUserCountHits = 0;
        this.notifyFingerprintHandlers();
      } else {
        this.pendingUserCount = null;
        this.pendingUserCountHits = 0;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Polling error (non-critical): ${msg}`);
    }
  }

  private scheduleReconnect(): void {
    // Reconnect/poll through tenant-scoped scheduled work.
  }

  private safeDisconnect(): void {
    if (this.pollingStartTimer) {
      clearTimeout(this.pollingStartTimer);
      this.pollingStartTimer = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    const instance = this.zk;
    this.deviceSessionVersion += 1;
    this.consecutiveBenignErrors = 0; // Reset error counter on disconnect
    this.connected = false;
    this.zk = null;
    if (instance) {
      this.destroyZkInstance(instance);
    }
  }

  /**
   * Tear down a ZKLib instance completely.
   *
   * node-zklib registers a `data` listener on its TCP socket via getRealTimeLogs.
   * When the socket closes/errors, that listener fires one final time with a null
   * chunk and crashes with "Cannot read properties of null (reading 'subarray')".
   * Removing all listeners + destroying the socket before discarding the instance
   * prevents this unhandled rejection entirely.
   */
  private destroyZkInstance(instance: ZKLib): void {
    try {
      // node-zklib 1.x stores the TCP connection at instance.zklibTcp.socket
      const zkInstance = instance as ZKLibInstance;
      const socket = zkInstance.zklibTcp?.socket ?? zkInstance.socket;
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    } catch {
      // best-effort — if the socket path changed in a library update, ignore
    }
    // Attempt a clean protocol-level disconnect as well (will fail silently if
    // the socket is already gone, which is fine).
    instance.disconnect().catch(() => { });
  }

  private isStaleSession(instance: ZKLib | null, sessionVersion: number): boolean {
    return (
      this.destroyed ||
      !this.connected ||
      !this.zk ||
      instance !== this.zk ||
      sessionVersion !== this.deviceSessionVersion
    );
  }



  async getUsers(): Promise<ZKUser[]> {
    if (this.usersFetchPromise) {
      return this.usersFetchPromise;
    }

    this.usersFetchPromise = this.getUsersInternal();
    try {
      return await this.usersFetchPromise;
    } finally {
      this.usersFetchPromise = null;
    }
  }

  private async getUsersInternal(): Promise<ZKUser[]> {
    if (!this.enabled) return [];
    if (!this.connected || !this.zk) {
      return [];
    }

    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      const result = await this.enqueueDeviceOperation(async () => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        return Promise.race([
          zkInstance.getUsers(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`COMMAND_TIMEOUT (${COMMAND_TIMEOUT_MS}ms for user fetch)`)), COMMAND_TIMEOUT_MS)
          ),
        ]);
      });

      // Success: reset error counter
      this.consecutiveBenignErrors = 0;
      return result?.data ?? [];
    } catch (err: unknown) {
      const msg = this.formatError(err);
      if (msg === 'STALE_ZK_SESSION') {
        return [];
      }

      const isTransportError = this.isBenignTransportError(err) || msg.includes('COMMAND_TIMEOUT');

      if (isTransportError) {
        this.consecutiveBenignErrors += 1;
        this.logger.warn(
          `ZKTeco user fetch paused: ${msg} (${this.consecutiveBenignErrors}/${MAX_BENIGN_ERRORS_BEFORE_RECONNECT})`,
        );

        // Progressive recovery: after multiple benign errors, force reconnect
        if (this.consecutiveBenignErrors >= MAX_BENIGN_ERRORS_BEFORE_RECONNECT) {
          this.logger.warn(
            `Too many consecutive transport errors (${this.consecutiveBenignErrors}) — forcing reconnect`,
          );
          this.consecutiveBenignErrors = 0;
          const staleInstance = this.zk;
          this.connected = false;
          this.zk = null;
          if (staleInstance) this.destroyZkInstance(staleInstance);
          this.scheduleReconnect();
        }
      } else {
        this.logger.error(`Error fetching users from device: ${msg}`);
        this.consecutiveBenignErrors = 0;
        const staleInstance = this.zk;
        this.connected = false;
        this.zk = null;
        if (staleInstance) this.destroyZkInstance(staleInstance);
        this.scheduleReconnect();
      }

      return [];
    }
  }

  async getAttendances(): Promise<ZKAttendance[]> {
    if (!this.enabled) return [];
    if (!this.connected || !this.zk) {
      return [];
    }

    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      const result = await this.enqueueDeviceOperation(async () => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        return Promise.race([
          zkInstance.getAttendances(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`COMMAND_TIMEOUT (${ATTENDANCE_FETCH_TIMEOUT_MS}ms)`)), ATTENDANCE_FETCH_TIMEOUT_MS)
          ),
        ]);
      });

      // Success: reset error counter
      this.consecutiveBenignErrors = 0;
      return result?.data ?? [];
    } catch (err: unknown) {
      const msg = this.formatError(err);
      if (msg === 'STALE_ZK_SESSION') {
        return [];
      }

      const isTransportError = this.isBenignTransportError(err) || msg.includes('COMMAND_TIMEOUT');

      if (isTransportError) {
        this.consecutiveBenignErrors += 1;
        this.logger.warn(
          `ZKTeco attendance fetch paused: ${msg} (${this.consecutiveBenignErrors}/${MAX_BENIGN_ERRORS_BEFORE_RECONNECT})`,
        );

        // Progressive recovery: after multiple benign errors, force reconnect
        if (this.consecutiveBenignErrors >= MAX_BENIGN_ERRORS_BEFORE_RECONNECT) {
          this.logger.warn(
            `Too many consecutive transport errors (${this.consecutiveBenignErrors}) — forcing reconnect`,
          );
          this.consecutiveBenignErrors = 0;
          const staleInstance = this.zk;
          this.connected = false;
          this.zk = null;
          if (staleInstance) this.destroyZkInstance(staleInstance);
          this.scheduleReconnect();
        }
      } else {
        this.logger.error(`Error fetching attendances from device: ${msg}`);
        this.consecutiveBenignErrors = 0;
        const staleInstance = this.zk;
        this.connected = false;
        this.zk = null;
        if (staleInstance) this.destroyZkInstance(staleInstance);
        this.scheduleReconnect();
      }

      return [];
    }
  }

  async deleteUser(userId: string): Promise<void> {
    await commitBeforeDeviceMutation();
    if (!this.enabled) return;
    if (!this.connected || !this.zk) {
      throw new Error('ZKTeco device is not connected');
    }

    // Look up the internal uid (serial) by enrollment userId — CMD_DELETE_USER needs the serial
    const users = await this.getUsers();
    const target = users.find((u) => String(u.userId) === userId);
    if (!target) {
      throw new Error(`User userId='${userId}' not found on device`);
    }

    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      const data = Buffer.alloc(2);
      data.writeUInt16LE(target.uid, 0);
      await this.enqueueDeviceOperation(() => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        return zkInstance.executeCmd(18, data);
      }); // CMD_DELETE_USER = 18 (takes internal serial uid)
    } catch (err: unknown) {
      const msg = this.formatError(err);
      if (msg === 'STALE_ZK_SESSION') {
        throw new Error('ZKTeco device session changed while deleting user');
      }
      this.logger.error(`Error deleting user userId=${userId} (uid=${target.uid}) from device: ${msg}`);
      const staleInstance = this.zk;
      this.connected = false;
      this.zk = null;
      if (staleInstance) this.destroyZkInstance(staleInstance);
      this.scheduleReconnect();
      throw new Error(`Failed to delete user from device: ${msg}`);
    }
  }

  /**
   * Remove all fingerprint templates for a user PIN while keeping the user record on device.
   */
  async deleteUserFingerprints(userId: string): Promise<void> {
    await commitBeforeDeviceMutation();
    if (!this.enabled) return;
    if (!this.connected || !this.zk) {
      throw new Error('ZKTeco device is not connected');
    }

    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      await this.enqueueDeviceOperation(() => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        // CMD_DELETE_USERTEMP = 19 — deletes all fingerprint templates for the PIN
        return zkInstance.executeCmd(19, String(userId));
      });
    } catch (err: unknown) {
      const msg = this.formatError(err);
      if (msg === 'STALE_ZK_SESSION') {
        throw new Error('ZKTeco device session changed while deleting fingerprints');
      }
      this.logger.error(`Error deleting fingerprints userId=${userId}: ${msg}`);
      const staleInstance = this.zk;
      this.connected = false;
      this.zk = null;
      if (staleInstance) this.destroyZkInstance(staleInstance);
      this.scheduleReconnect();
      throw new Error(`Failed to delete fingerprints from device: ${msg}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record that the physical device checked in via the ADMS cloud push protocol.
   * Called by IclockService on every heartbeat and data push.
   */
  recordCloudContact(sn: string): void {
    this.lastCloudContactAt = new Date();
    this.cloudSn = (sn || '').trim().toUpperCase() || null;
  }

  /**
   * Returns true when the device has pushed data within the last 5 minutes,
   * indicating it is reachable via cloud (ADMS) mode.
   */
  isCloudConnected(): boolean {
    if (!this.lastCloudContactAt) return false;
    return Date.now() - this.lastCloudContactAt.getTime() < ZKTecoService.CLOUD_CONNECTED_WINDOW_MS;
  }

  /** Returns the serial number of the last cloud-connected device, or null. */
  getCloudDeviceSn(): string | null {
    return this.isCloudConnected() ? this.cloudSn : null;
  }

  /**
   * SN for queuing ADMS commands (enroll/delete). Slightly more tolerant than
   * the UI connected badge so a brief quiet period does not block enrollment.
   */
  getCloudCommandSn(): string | null {
    if (!this.cloudSn || !this.lastCloudContactAt) return null;
    if (Date.now() - this.lastCloudContactAt.getTime() > ZKTecoService.CLOUD_COMMAND_SN_WINDOW_MS) {
      return null;
    }
    return this.cloudSn;
  }

  getConnectionIp(): string {
    return this.ip;
  }

  getConnectionPort(): number {
    return this.port;
  }

  /**
   * Open a short-lived throw-away connection to ip:port and immediately close it.
   * Returns true if the ZK handshake succeeded within timeoutMs, false otherwise.
   * Never touches the live session or this.zk.
   */
  async probeConnection(ip: string, port: number, timeoutMs: number): Promise<boolean> {
    const probe = new ZKLib(ip, port, timeoutMs, 0) as ZKLibInstance;
    try {
      await Promise.race([
        probe.createSocket(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PROBE_TIMEOUT')), timeoutMs),
        ),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      probe.disconnect().catch(() => { });
      const socket = probe.zklibTcp?.socket ?? probe.socket;
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    }
  }

  /**
   * Disconnect from the current device, update target IP/port, then reconnect.
   * Called by DeviceConfigService when the stored network config changes.
   */
  async reconnectWithNewConfig(newIp: string, newPort: number): Promise<void> {
    if (!this.enabled) return;
    const previousIp = this.ip;
    const previousPort = this.port;

    this.logger.log(`Reconnecting ZKTeco service → ${newIp}:${newPort}`);

    if (previousIp === newIp && previousPort === newPort) {
      return;
    }

    this.ip = newIp;
    this.port = newPort;

    if (this.connecting) {
      return;
    }

    this.safeDisconnect(); // already nulls this.zk and destroys socket
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.connect();
  }

  /**
   * Write a single device parameter using CMD_OPTIONS_WRQ (14).
   * e.g. key='IPAddress', value='192.168.1.100'
   */
  async setDeviceParam(key: string, value: string): Promise<void> {
    if (!this.enabled) return;
    if (!this.connected || !this.zk) {
      throw new Error('ZKTeco device is not connected');
    }
    await commitBeforeDeviceMutation();
    try {
      await this.zk.executeCmd(14, `${key}=${value}`);
      this.logger.log(`Device param set: ${key}=${value}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to set device param ${key}: ${msg}`);
      // An IP change causes the device to restart and immediately drops the socket.
      // This is expected — don't mark as failed unless the key is something else.
      if (key !== 'IPAddress' && key !== 'GATEIPAddress' && key !== 'NetMask' && key !== 'DNSServer') {
        throw new Error(`Failed to set ${key}: ${msg}`);
      }
    }
  }

  /**
   * Read a single device parameter using CMD_OPTIONS_RRQ (13).
   * Returns null if not connected or on error.
   */
  async getDeviceParam(key: string): Promise<string | null> {
    if (!this.enabled || !this.connected || !this.zk) return null;
    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      const result = await this.enqueueDeviceOperation(() => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        return zkInstance.executeCmd(13, key);
      });
      if (Buffer.isBuffer(result)) {
        const raw = result.toString('utf8').split('\x00')[0].trim();
        // Response format: "key=value" — extract the value part
        const eqIdx = raw.indexOf('=');
        return eqIdx >= 0 ? raw.slice(eqIdx + 1) : raw;
      }
      return String(result).trim();
    } catch (err: unknown) {
      if (this.formatError(err) === 'STALE_ZK_SESSION') {
        return null;
      }
      return null;
    }
  }

  /** Fetch live network config directly from the device. */
  async getDeviceNetworkInfo(): Promise<{
    ip: string | null;
    subnetMask: string | null;
    gateway: string | null;
    dns: string | null;
  }> {
    const [ip, subnetMask, gateway, dns] = await Promise.all([
      this.getDeviceParam('IPAddress'),
      this.getDeviceParam('NetMask'),
      this.getDeviceParam('GATEIPAddress'),
      this.getDeviceParam('DNSServer'),
    ]);
    return { ip, subnetMask, gateway, dns };
  }

  /** Restart the device (CMD_RESTART = 1004). */
  async restartDevice(): Promise<void> {
    if (!this.enabled || !this.connected || !this.zk) return;
    const zkInstance = this.zk;
    const sessionVersion = this.deviceSessionVersion;
    try {
      await this.enqueueDeviceOperation(() => {
        if (this.isStaleSession(zkInstance, sessionVersion)) {
          throw new Error('STALE_ZK_SESSION');
        }
        return zkInstance.executeCmd(1004, '');
      });
      this.logger.log('Device restart command sent');
    } catch {
      // A restart drops the connection — expected
    }
  }

  private enqueueDeviceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.deviceOperationQueue.then(operation, operation);
    this.deviceOperationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    if (typeof err === 'object' && err !== null) {
      const errorLike = err as {
        message?: unknown;
        code?: unknown;
        errno?: unknown;
        syscall?: unknown;
        address?: unknown;
        port?: unknown;
        ip?: unknown;
        command?: unknown;
      };

      // ZKError wraps the real error in .err — prefer its message/code over the top-level fields
      const nested = (errorLike as { err?: { message?: unknown; code?: unknown } }).err;

      const parts: string[] = [];
      const pushPart = (label: string, value: unknown) => {
        if (value === undefined || value === null || value === '') return;
        parts.push(`${label}=${String(value)}`);
      };

      pushPart('message', errorLike.message ?? nested?.message);
      pushPart('code', errorLike.code ?? nested?.code);
      pushPart('errno', errorLike.errno);
      pushPart('syscall', errorLike.syscall);
      pushPart('address', errorLike.address);
      pushPart('port', errorLike.port);
      pushPart('ip', errorLike.ip);
      pushPart('command', errorLike.command);

      if (parts.length > 0) {
        return parts.join(', ');
      }

      try {
        return JSON.stringify(err);
      } catch {
        return Object.prototype.toString.call(err);
      }
    }

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  private isBenignTransportError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) {
      return false;
    }

    const errorLike = err as { code?: string; err?: { code?: string }; command?: string };
    const code = errorLike.code ?? errorLike.err?.code;
    if (code === 'ERR_STREAM_WRITE_AFTER_END') {
      return true;
    }

    const message = this.formatError(err);
    return message.includes('"command":"[TCP] undefined"') || message.includes('[TCP] undefined');
  }

  private notifyFingerprintHandlers(): void {
    for (const handler of this.fingerprintHandlers) {
      Promise.resolve(handler()).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Fingerprint event handler failed: ${msg}`);
      });
    }
  }
}
