import { commitBeforeDeviceMutation, tenantStorage } from '../tenancy/tenant-context.js';
import { TenantCron, TenantJobs } from '../tenancy/tenant-jobs.js';
import { DeviceState } from '../tenancy/device-state.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DeviceUser, DeviceUserStatus } from './entities/device-user.entity';
import { Employee } from '../employee/entities/employee.entity';
import { ZKTecoService } from './zkteco.service';
import { BiometricGateway } from './biometric.gateway';
import { AdmsCommandQueue } from './adms-command.queue';
import {
  computeNextEnrollPin,
  parseEnrollPin,
} from './allocate-next-pin';

@Injectable()
@DeviceState()
export class DeviceUserService implements OnModuleInit {
  private readonly logger = new Logger(DeviceUserService.name);
  // Must cover: ZKTeco initial delay (10s) + 2 failed connect attempts (~30s) + reconnect delay (15s) + reconnect attempt (~15s)
  private readonly initialSyncTimeoutMs = 75_000;
  private readonly initialSyncPollIntervalMs = 1_000;
  private static readonly PENDING_ENROLL_TTL_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(DeviceUser)
    private readonly deviceUserRepo: Repository<DeviceUser>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    private readonly zkTecoService: ZKTecoService,
    private readonly biometricGateway: BiometricGateway,
    private readonly admsCommands: AdmsCommandQueue,
    @Optional() private readonly tenantJobs?: TenantJobs,
  ) { }

  private syncLock = false;
  private allocateQueue: Promise<void> = Promise.resolve();
  /**
   * PIN → expiry for enrollments we asked the device to start. Entries MUST expire:
   * an abandoned enrollment (employee never scans, device offline, employee deleted)
   * would otherwise occupy its UID for the lifetime of the process and push every
   * later allocation past the real device occupancy.
   */
  private readonly pendingCloudRegistrationUids = new Map<string, number>();
  /** PIN → employeeId for admin-initiated enrollments awaiting FP on device */
  private readonly pendingEnrollByPin = new Map<
    string,
    { employeeId: string; expiresAt: number }
  >();
  /** Pending "complete from OPERLOG" timers, keyed by device UID. */
  private readonly enrollmentFallbackTimers = new Map<string, NodeJS.Timeout>();
  /** How long to wait for a template push before trusting OPERLOG instead. */
  private static readonly TEMPLATE_PUSH_GRACE_MS = 12_000;
  /**
   * Active ADMS `DATA QUERY USERINFO` dump — collect PINs as the device pushes
   * USERINFO, and suppress link-modals / pending-registration side effects.
   */
  private cloudUserQuery: { sn: string; pins: Set<string> } | null = null;
  /** Short-lived live occupancy cache so consecutive enrolls skip a full re-query. */
  private livePinsCache: { pins: Set<number>; expiresAt: number } | null = null;
  private static readonly LIVE_PINS_CACHE_TTL_MS = 60_000;
  private static readonly CLOUD_USER_QUERY_TIMEOUT_MS = 15_000;

  onModuleInit(): void {
    // Device work runs with a registered tenant/device scope.
  }

  private async waitForDeviceConnectionAndSync(): Promise<void> {
    // In cloud-only mode (ZKTECO_ENABLED=false) there is no TCP connection to wait for.
    // Device users arrive via ADMS cloud push (IclockService → upsertFromCloud) instead.
    if (!this.zkTecoService.isEnabled()) {
      this.logger.debug('Initial device sync skipped — TCP polling disabled (cloud-only mode, device connects via ADMS push)');
      return;
    }

    const startedAt = Date.now();

    while (Date.now() - startedAt < this.initialSyncTimeoutMs) {
      if (this.zkTecoService.isConnected()) {
        await this.syncWithDevice();
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, this.initialSyncPollIntervalMs));
    }

    this.logger.debug('Initial device sync skipped because the ZKTeco device never became reachable during startup');
  }

  @TenantCron('*/35 * * * * *')
  async syncRegisteredDevices(): Promise<void> {
    await this.zkTecoService.connect();
    await this.syncWithDevice();
  }

  async syncWithDevice(): Promise<void> {
    if (!this.zkTecoService.isConnected()) {
      return;
    }
    if (this.syncLock) {
      this.logger.debug('syncWithDevice already in progress — skipping concurrent call');
      return;
    }
    this.syncLock = true;
    try {
      await this.syncWithDeviceInternal();
    } finally {
      this.syncLock = false;
    }
  }

  private async syncWithDeviceInternal(): Promise<void> {
    const users = await this.zkTecoService.getUsers();
    // Capture connected state immediately after getUsers() — it's set to false inside
    // getUsers() if the device threw or was unreachable, so this reliably tells us
    // whether the empty list means "device has no users" vs "device is offline".
    const deviceConnected = this.zkTecoService.isConnected();
    const deviceUidSet = new Set(users.map((user) => String(user.userId)));

    for (const zkUser of users) {
      const deviceUid = String(zkUser.userId);
      await this.upsertDeviceUser(deviceUid, zkUser.name?.trim() || null);
    }

    // Only mark users as DELETED when the device actually returned a non-empty
    // user list. An empty getUsers() while "connected" is often a transient
    // failure — treating it as a wipe would clear the mirror and force UID 1.
    if (users.length > 0) {
      const allDbUsers = await this.deviceUserRepo.find();
      for (const dbUser of allDbUsers) {
        if (!deviceUidSet.has(dbUser.deviceUid) && dbUser.status !== DeviceUserStatus.DELETED) {
          // Mark the DeviceUser row as DELETED, but preserve linkedEmployeeId and
          // DO NOT touch Employee.fingerprintCode. Both are authoritative link records
          // that must survive transient offline periods so the link is fully restored
          // (status → LINKED, linkedEmployeeId intact) the moment the device comes
          // back. Clearing linkedEmployeeId here causes the user to be restored as
          // UNLINKED, which can then be mistakenly deleted by an admin and trigger
          // clearFingerprintCode — permanently breaking the employee link.
          dbUser.status = DeviceUserStatus.DELETED;
          await this.deviceUserRepo.save(dbUser);
          this.logger.log(`Device user marked as deleted: uid=${dbUser.deviceUid} (no longer on device)`);
        }
      }
    } else {
      this.logger.debug(
        `syncWithDevice: skipping deletion step (users=${users.length}, connected=${deviceConnected})`,
      );
    }

    // Repair orphaned LINKED device users.
    // linkedEmployeeId may be null for rows created before this fix or from other edge cases.
    // Use Employee.fingerprintCode as the authoritative fallback to recover the linkage.
    const linkedUsers = await this.deviceUserRepo.find({
      where: { status: DeviceUserStatus.LINKED },
    });
    for (const linkedUser of linkedUsers) {
      let employee: Employee | null = null;

      if (linkedUser.linkedEmployeeId) {
        employee = await this.employeeRepo.findOne({ where: { id: linkedUser.linkedEmployeeId } });
        if (!employee) {
          linkedUser.status = DeviceUserStatus.UNLINKED;
          linkedUser.linkedEmployeeId = null;
          await this.deviceUserRepo.save(linkedUser);
          this.logger.warn(`Device user reset to UNLINKED: uid=${linkedUser.deviceUid} (employee deleted)`);
          continue;
        }
      } else {
        // linkedEmployeeId is missing — try to recover via fingerprintCode
        employee = (null as Employee | null);
        if (employee) {
          linkedUser.linkedEmployeeId = employee.id;
          await this.deviceUserRepo.save(linkedUser);
          this.logger.log(`Recovered linkedEmployeeId for device user uid=${linkedUser.deviceUid} → ${employee.name}`);
        } else {
          linkedUser.status = DeviceUserStatus.UNLINKED;
          await this.deviceUserRepo.save(linkedUser);
          this.logger.warn(`Orphaned device user reset to UNLINKED: uid=${linkedUser.deviceUid} (no matching employee)`);
          continue;
        }
      }

      // employee is now resolved. Verify and repair fingerprintCode — never auto-unlink.
      if (!employee.fingerprintCode) {
        // fingerprintCode was cleared — restore it. The device user record is authoritative.
        employee.fingerprintCode = linkedUser.deviceUid;
        await this.employeeRepo.save(employee);
        this.logger.log(`Restored fingerprintCode for employee "${employee.name}": uid=${linkedUser.deviceUid}`);
      } else if (employee.fingerprintCode !== linkedUser.deviceUid) {
        // Mismatch detected — but do NOT auto-unlink. Automatic unlinking based on a
        // data inconsistency is what causes the recurring "fingerprint lost" problem.
        // Only a deliberate manual unlink/delete action may sever a link.
        // Log the anomaly so an admin can investigate and fix it manually.
        this.logger.warn(
          `Mismatch: device user uid=${linkedUser.deviceUid} is LINKED to employee ` +
          `"${employee.name}" but employee.fingerprintCode="${employee.fingerprintCode}". ` +
          `No automatic unlink applied — resolve manually if this is unintended.`,
        );
      }
    }
  }

  private async upsertDeviceUser(
    deviceUid: string,
    name: string | null,
    options?: { emitModal?: boolean; markPending?: boolean; emitForPendingOnly?: boolean; deviceSerial?: string | null },
  ): Promise<void> {
    // Final safety net: a device UID must be a positive integer. This blocks
    // IP addresses and other config noise that ADMS INFO/OPTIONS pushes can leak
    // (e.g. the cloud server IP "13.140.141.131") from becoming phantom users.
    if (!/^\d{1,10}$/.test(deviceUid.trim()) || deviceUid.trim() === '0') {
      this.logger.warn(`Rejected invalid device UID from upsert: "${deviceUid}"`);
      return;
    }

    const emitModal = options?.emitModal ?? true;
    const markPending = options?.markPending ?? false;
    const emitForPendingOnly = options?.emitForPendingOnly ?? false;
    const deviceSerial = options?.deviceSerial?.trim() || null;
    const existing = await this.deviceUserRepo.findOne({ where: { deviceUid } });

    if (markPending) {
      this.markCloudRegistrationPending(deviceUid);
    }

    if (existing) {
      if (existing.status === DeviceUserStatus.DELETED) {
        // User reappeared on device — restore the link to the employee if still valid.
        let linkedEmployeeId = existing.linkedEmployeeId;
        let restoredStatus = DeviceUserStatus.UNLINKED;

        // Primary: verify the previously stored linkedEmployeeId is still valid.
        if (linkedEmployeeId) {
          const employee = await this.employeeRepo.findOne({
            where: { id: linkedEmployeeId },
          });
          if (employee) {
            if (employee.fingerprintCode === deviceUid) {
              // Perfect match — restore as LINKED.
              restoredStatus = DeviceUserStatus.LINKED;
            } else if (employee.fingerprintCode === null) {
              // fingerprintCode was cleared by a previous bug. The employee is still
              // the correct owner — repair fingerprintCode immediately and restore as LINKED.
              employee.fingerprintCode = deviceUid;
              await this.employeeRepo.save(employee);
              this.logger.log(
                `Repaired fingerprintCode during restore for employee "${employee.name}": uid=${deviceUid}`,
              );
              restoredStatus = DeviceUserStatus.LINKED;
            } else {
              // employee.fingerprintCode is a different non-null UID — employee was
              // intentionally reassigned to another device. This record is stale.
              linkedEmployeeId = null;
            }
          } else {
            linkedEmployeeId = null; // employee was deleted
          }
        }

        // Fallback: linkedEmployeeId may be null if this row was created before the
        // "preserve linkedEmployeeId on delete" fix, or if an inconsistency slipped
        // through. Recover via fingerprintCode, which is the authoritative source.
        if (!linkedEmployeeId) {
          const employee = (null as Employee | null);
          if (employee) {
            linkedEmployeeId = employee.id;
            restoredStatus = DeviceUserStatus.LINKED;
            this.logger.log(
              `Recovered link for restored device user uid=${deviceUid} → employee "${employee.name}" via fingerprintCode fallback`,
            );
          }
        }

        existing.status = restoredStatus;
        existing.linkedEmployeeId = linkedEmployeeId;
        existing.name = name ?? existing.name;
        existing.deviceSerial = deviceSerial ?? existing.deviceSerial;
        await this.deviceUserRepo.save(existing);
        this.logger.log(
          `Device user restored: uid=${deviceUid} name=${existing.name ?? '-'} status=${restoredStatus}`,
        );
        // Only alert the frontend when the user genuinely needs to be linked.
        // Emitting for a LINKED restore would show a "new fingerprint" modal for an
        // already-linked user, causing admins to accidentally delete it and breaking the link.
        if (
          emitModal &&
          restoredStatus === DeviceUserStatus.UNLINKED &&
          (!emitForPendingOnly || this.isCloudRegistrationPending(deviceUid))
        ) {
          if (await this.tryCompletePendingEnrollment(deviceUid, existing.name)) {
            return;
          }
          this.biometricGateway.emitNewDeviceUser({
            id: existing.id,
            device_uid: existing.deviceUid,
            name: existing.name,
          });
          this.pendingCloudRegistrationUids.delete(deviceUid);
        }
      } else if ((name !== null && existing.name !== name) || (deviceSerial && existing.deviceSerial !== deviceSerial)) {
        if (name !== null) existing.name = name;
        if (deviceSerial) existing.deviceSerial = deviceSerial;
        await this.deviceUserRepo.save(existing);
      }

      if (
        emitModal &&
        existing.status === DeviceUserStatus.UNLINKED &&
        (!emitForPendingOnly || this.isCloudRegistrationPending(deviceUid))
      ) {
        if (await this.tryCompletePendingEnrollment(deviceUid, existing.name)) {
          return;
        }
        this.biometricGateway.emitNewDeviceUser({
          id: existing.id,
          device_uid: existing.deviceUid,
          name: existing.name,
        });
        this.pendingCloudRegistrationUids.delete(deviceUid);
      }

      // For any LINKED user: verify the employee still exists and keep fingerprintCode in sync.
      // The ONLY reason to auto-unlink here is if the employee record was physically deleted
      // from the database. Any other state (NULL or mismatched fingerprintCode) is treated as
      // data damage that must be repaired — not a reason to silently drop the link.
      if (existing.status === DeviceUserStatus.LINKED && existing.linkedEmployeeId) {
        const employee = await this.employeeRepo.findOne({
          where: { id: existing.linkedEmployeeId },
        });
        if (!employee) {
          // Employee was deleted — the only legitimate reason to auto-unlink.
          existing.status = DeviceUserStatus.UNLINKED;
          existing.linkedEmployeeId = null;
          await this.deviceUserRepo.save(existing);
          this.logger.warn(`Device user ${deviceUid} unlinked: linked employee no longer exists.`);
        } else if (!employee.fingerprintCode) {
          // fingerprintCode was cleared — repair it immediately so attendance matching works.
          employee.fingerprintCode = deviceUid;
          await this.employeeRepo.save(employee);
          this.logger.log(`Repaired fingerprintCode for employee "${employee.name}": uid=${deviceUid}`);
        } else if (employee.fingerprintCode !== deviceUid) {
          // Mismatch — do NOT auto-unlink. Log for manual investigation only.
          this.logger.warn(
            `Mismatch: device user uid=${deviceUid} is LINKED to employee "${employee.name}" ` +
            `but employee.fingerprintCode="${employee.fingerprintCode}". ` +
            `No automatic unlink applied — resolve manually if this is unintended.`,
          );
        }
      }

      return;
    }

    const newUser = await this.deviceUserRepo.save(
      this.deviceUserRepo.create({
        deviceUid,
        name,
        deviceSerial,
        status: DeviceUserStatus.UNLINKED,
      }),
    );

    this.logger.log(`New device user detected: uid=${deviceUid} name=${name ?? '-'} sn=${deviceSerial ?? '-'}`);
    if (emitModal) {
      if (await this.tryCompletePendingEnrollment(deviceUid, newUser.name)) {
        return;
      }
      this.biometricGateway.emitNewDeviceUser({
        id: newUser.id,
        device_uid: newUser.deviceUid,
        name: newUser.name,
      });
      this.pendingCloudRegistrationUids.delete(deviceUid);
    }
  }

  findAll(): Promise<DeviceUser[]> {
    return this.deviceUserRepo.find({ order: { createdAt: 'DESC' } });
  }

  findUnlinked(): Promise<DeviceUser[]> {
    return this.deviceUserRepo.find({
      where: { status: DeviceUserStatus.UNLINKED },
      order: { createdAt: 'DESC' },
    });
  }

  deviceStatus(): { connected: boolean; enabled: boolean; cloudSn: string | null } {
    return {
      connected: this.zkTecoService.isConnected() || this.zkTecoService.isCloudConnected(),
      enabled: this.zkTecoService.isEnabled(),
      cloudSn: this.zkTecoService.getCloudDeviceSn(),
    };
  }

  /**
   * Admin-initiated enrollment: create/update user on device and open FP capture UI.
   * When the device pushes the FP template, we auto-link to this employee.
   */
  async startEnrollmentForEmployee(employeeId: string): Promise<{
    deviceUid: string;
    employeeId: string;
    status: 'waiting';
    message: string;
  }> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }

    const sn = this.requireCloudCommandSn();
    const safeName = (employee.name || 'Employee').replace(/[\t\r\n]+/g, ' ').trim().slice(0, 24);
    const existingPin = employee.fingerprintCode?.trim() || null;

    const reusableDeviceUser = await this.deviceUserRepo.findOne({
      where: {
        linkedEmployeeId: employee.id,
        status: In([DeviceUserStatus.UNLINKED, DeviceUserStatus.LINKED]),
      },
      order: { createdAt: 'DESC' },
    });

    let deviceUid: string;
    let enrollmentCommands: string[];

    if (existingPin) {
      // Re-enroll on the same PIN — clear template only, then open FP UI immediately.
      deviceUid = existingPin;
      enrollmentCommands = [
        `DATA DELETE FINGERTMP PIN=${deviceUid}`,
        `ENROLL_FP PIN=${deviceUid}\tFID=0\tRETRY=3\tOVERWRITE=1`,
      ];
    } else if (reusableDeviceUser && reusableDeviceUser.status !== DeviceUserStatus.DELETED) {
      // Fingerprint was removed but the user PIN still exists on the device.
      deviceUid = reusableDeviceUser.deviceUid;
      enrollmentCommands = [`ENROLL_FP PIN=${deviceUid}\tFID=0\tRETRY=3\tOVERWRITE=1`];
    } else {
      deviceUid = await this.allocateNextPin();
      enrollmentCommands = [
        `DATA UPDATE USERINFO PIN=${deviceUid}\tName=${safeName}\tPrivilege=0\tCard=\tGrp=0`,
        `ENROLL_FP PIN=${deviceUid}\tFID=0\tRETRY=3\tOVERWRITE=1`,
      ];
    }

    this.pendingEnrollByPin.set(deviceUid, {
      employeeId: employee.id,
      expiresAt: Date.now() + DeviceUserService.PENDING_ENROLL_TTL_MS,
    });

    try {
      await this.upsertDeviceUser(deviceUid, safeName, {
        emitModal: false,
        markPending: true,
        deviceSerial: sn,
      });

      const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid } });
      if (deviceUser) {
        deviceUser.linkedEmployeeId = employee.id;
        if (deviceUser.status === DeviceUserStatus.DELETED) {
          deviceUser.status = DeviceUserStatus.UNLINKED;
        }
        await this.deviceUserRepo.save(deviceUser);
      }
      if (tenantStorage.getStore()) await commitBeforeDeviceMutation();
      this.admsCommands.enqueueEnrollmentPriority(sn, enrollmentCommands);
    } catch (err: unknown) {
      // The enrollment never reached the terminal — give the UID straight back
      // instead of leaving it reserved until the TTL runs out.
      this.releaseReservation(deviceUid);
      this.invalidateLivePinsCache();
      throw err;
    }

    this.biometricGateway.emitEnrollmentStatus({
      employeeId: employee.id,
      deviceUid,
      status: 'waiting',
      message:
        'Enrollment sent to the ZKTeco. Place your finger on the terminal when prompted.',
    });

    this.logger.log(
      `Enrollment started employee=${employee.id} pin=${deviceUid} sn=${sn} cmds=${enrollmentCommands.length} (priority)`,
    );

    return {
      deviceUid,
      employeeId: employee.id,
      status: 'waiting',
      message:
        'Enrollment sent to the ZKTeco. The fingerprint screen should open shortly — then scan.',
    };
  }

  /**
   * Remove only the fingerprint template from the device. The user PIN stays on the ZKTeco
   * so the employee can re-register immediately on the same PIN.
   */
  async removeFingerprintForEmployee(
    employeeId: string,
    options?: { skipNotFound?: boolean },
  ): Promise<{ employeeId: string; removedUid: string | null }> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }

    const deviceUid = employee.fingerprintCode?.trim() || null;
    if (!deviceUid) {
      if (options?.skipNotFound) {
        return { employeeId: employee.id, removedUid: null };
      }
      throw new BadRequestException('Employee has no linked fingerprint');
    }

    this.releaseReservation(deviceUid);
    await this.removeFingerprintFromPhysicalDevice(deviceUid, true);

    employee.fingerprintCode = null;
    await this.employeeRepo.save(employee);

    const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid } });
    if (deviceUser) {
      deviceUser.status = DeviceUserStatus.UNLINKED;
      deviceUser.linkedEmployeeId = employee.id;
      await this.deviceUserRepo.save(deviceUser);
    }

    this.logger.log(
      `Removed fingerprint template uid=${deviceUid} from employee=${employee.id} (user kept on device)`,
    );
    return { employeeId: employee.id, removedUid: deviceUid };
  }

  /**
   * Delete the employee's device user when the employee is permanently removed from the app.
   */
  async purgeEmployeeFromDevice(employeeId: string): Promise<void> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }

    const deviceUid =
      employee.fingerprintCode?.trim() ||
      (
        await this.deviceUserRepo.findOne({
          where: {
            linkedEmployeeId: employeeId,
            status: In([DeviceUserStatus.LINKED, DeviceUserStatus.UNLINKED]),
          },
          order: { createdAt: 'DESC' },
        })
      )?.deviceUid ||
      null;

    if (!deviceUid) {
      return;
    }

    this.releaseReservation(deviceUid);
    await this.removeFromPhysicalDevice(deviceUid, true);

    const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid } });
    if (deviceUser) {
      deviceUser.status = DeviceUserStatus.DELETED;
      deviceUser.linkedEmployeeId = null;
      await this.deviceUserRepo.save(deviceUser);
    }

    if (employee.fingerprintCode) {
      employee.fingerprintCode = null;
      await this.employeeRepo.save(employee);
    }

    this.invalidateLivePinsCache();
    this.logger.log(`Purged device user uid=${deviceUid} for deleted employee=${employeeId}`);
  }

  private requireCloudCommandSn(): string {
    const sn =
      this.zkTecoService.getCloudCommandSn() ?? this.zkTecoService.getCloudDeviceSn();
    if (sn) return sn;

    if (this.zkTecoService.isConnected()) {
      throw new BadRequestException(
        'Remote enrollment requires ADMS cloud mode. Device is on TCP only — enroll from the device or switch to cloud ADMS.',
      );
    }

    throw new BadRequestException(
      'ZKTeco device is not connected. Wait until Unlinked Users shows Connected, then try again.',
    );
  }

  private requireCloudDeviceSn(): string {
    return this.requireCloudCommandSn();
  }

  /**
   * Next enrollment PIN = smallest unused UID ≥ 1 across every occupancy source.
   * Fills gaps first (e.g. used 5–14 → assign 1); if 1..max are full, uses max+1.
   * Never overwrites or renumbers an existing employee's UID.
   */
  private async allocateNextPin(): Promise<string> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.allocateQueue;
    this.allocateQueue = previous.then(() => gate);
    await previous;
    try {
      return await this.allocateNextPinUnlocked();
    } finally {
      release();
    }
  }

  private async allocateNextPinUnlocked(): Promise<string> {
    const used = new Set<number>();

    const addPin = (raw: string | null | undefined) => {
      const n = parseEnrollPin(raw);
      if (n != null) used.add(n);
    };

    // 1) In-flight reservations only — expired ones are released first, otherwise an
    //    abandoned enrollment would occupy its UID forever and every later allocation
    //    would skip past the device's real occupancy.
    this.sweepExpiredReservations();
    for (const pin of this.pendingEnrollByPin.keys()) addPin(pin);
    for (const pin of this.pendingCloudRegistrationUids.keys()) addPin(pin);

    // 2) Employees already linked — permanent UIDs must never be reused or shifted
    const linkedEmployees = await this.employeeRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.fingerprintCode'])
      .where('e.fingerprintCode IS NOT NULL')
      .getMany();
    for (const emp of linkedEmployees) addPin(emp.fingerprintCode);

    // 3) Live terminal dump (best effort) — never trust an empty dump as “no users”
    const livePins = await this.refreshLiveDevicePins();
    if (livePins) {
      for (const n of livePins) used.add(n);
    }

    // 4) Always union active DB mirror rows (after live reconcile when it succeeded).
    const activeRows = await this.deviceUserRepo.find({
      where: {
        status: In([DeviceUserStatus.LINKED, DeviceUserStatus.UNLINKED]),
      },
      select: { deviceUid: true },
    });
    for (const row of activeRows) addPin(row.deviceUid);

    let next: string;
    try {
      next = computeNextEnrollPin(used);
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'No free fingerprint PIN available',
      );
    }

    const nextNum = Number(next);
    // Hard guard: never return a PIN that is already occupied (overwrite / “shift” bug).
    if (used.has(nextNum)) {
      throw new BadRequestException(
        `Refusing to allocate UID ${next} — it is already in use. Existing employee UIDs are permanent.`,
      );
    }

    // Reserve immediately so a concurrent enroll cannot take the same gap.
    this.pendingEnrollByPin.set(next, {
      employeeId: '__reserving__',
      expiresAt: Date.now() + 60_000,
    });

    if (this.livePinsCache) {
      this.livePinsCache.pins.add(nextNum);
    }

    this.logger.log(
      `allocateNextPin: next=${next} (lowest free) occupied=${used.size} sources={` +
        `linked=${linkedEmployees.length}, live=${livePins ? livePins.size : 'none'}, ` +
        `activeDb=${activeRows.length}, pendingEnroll=[${[...this.pendingEnrollByPin.keys()].join(',')}], ` +
        `pendingCloud=[${[...this.pendingCloudRegistrationUids.keys()].join(',')}]}`,
    );
    return next;
  }

  /**
   * Fetch PINs currently on the terminal (TCP getUsers, or ADMS DATA QUERY USERINFO).
   * Returns null when occupancy cannot be trusted — caller keeps DB/employee sources.
   */
  private async refreshLiveDevicePins(): Promise<Set<number> | null> {
    if (
      this.livePinsCache &&
      Date.now() < this.livePinsCache.expiresAt &&
      this.livePinsCache.pins.size > 0
    ) {
      return new Set(this.livePinsCache.pins);
    }

    const toPinSet = (rawPins: Iterable<string>): Set<number> => {
      const pins = new Set<number>();
      for (const raw of rawPins) {
        const n = parseEnrollPin(String(raw));
        if (n != null) pins.add(n);
      }
      return pins;
    };

    // TCP path — empty list is unreliable (timeouts / stale session often return []).
    try {
      if (this.zkTecoService.isEnabled() && this.zkTecoService.isConnected()) {
        const users = await this.zkTecoService.getUsers();
        const pins = toPinSet(users.map((u) => String(u.userId)));
        if (pins.size === 0) {
          this.logger.warn(
            'refreshLiveDevicePins TCP: getUsers returned 0 pins — treating as unreliable (will not assign UID 1 from empty dump)',
          );
          // Fall through to ADMS / DB rather than wiping occupancy.
        } else {
          await this.reconcileDeletedAgainstLivePins(
            [...pins].map((n) => String(n)),
          );
          this.livePinsCache = {
            pins,
            expiresAt: Date.now() + DeviceUserService.LIVE_PINS_CACHE_TTL_MS,
          };
          return pins;
        }
      }
    } catch (err: unknown) {
      this.logger.debug(
        `refreshLiveDevicePins TCP failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Cloud ADMS path: ask the device to dump USERINFO, collect PINs as they push.
    const sn =
      this.zkTecoService.getCloudCommandSn() ??
      this.zkTecoService.getCloudDeviceSn();
    if (!sn) return null;

    this.cloudUserQuery = { sn: sn.trim().toUpperCase(), pins: new Set() };
    try {
      await this.admsCommands.enqueueAndAwait(
        sn,
        'DATA QUERY USERINFO',
        DeviceUserService.CLOUD_USER_QUERY_TIMEOUT_MS,
      );
      // Trailing USERINFO lines can arrive just after the command ACK.
      await new Promise((resolve) => setTimeout(resolve, 800));

      const pins = toPinSet(this.cloudUserQuery.pins);
      if (pins.size > 0) {
        await this.reconcileDeletedAgainstLivePins(
          [...this.cloudUserQuery.pins],
        );
        this.livePinsCache = {
          pins,
          expiresAt: Date.now() + DeviceUserService.LIVE_PINS_CACHE_TTL_MS,
        };
        this.logger.log(
          `refreshLiveDevicePins ADMS: ${pins.size} user(s) on device SN=${sn}`,
        );
        return pins;
      }

      // ACK without USERINFO — do not treat as an empty device (avoids assigning UID 1
      // and mass-deleting mirror rows when the firmware ignores QUERY).
      this.logger.warn(
        `refreshLiveDevicePins ADMS: QUERY ACK with no USERINFO for SN=${sn} — falling back`,
      );
      return null;
    } catch (err: unknown) {
      const partial = toPinSet(this.cloudUserQuery?.pins ?? []);
      if (partial.size > 0) {
        this.logger.warn(
          `refreshLiveDevicePins ADMS partial (${partial.size} pin(s)) — ${err instanceof Error ? err.message : String(err)}`,
        );
        this.livePinsCache = {
          pins: partial,
          expiresAt: Date.now() + DeviceUserService.LIVE_PINS_CACHE_TTL_MS,
        };
        return partial;
      }
      this.logger.warn(
        `refreshLiveDevicePins ADMS failed — ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      this.cloudUserQuery = null;
    }
  }

  private async reconcileDeletedAgainstLivePins(
    livePins: string[],
  ): Promise<void> {
    // Never reconcile against an empty dump — that would mark every user DELETED
    // and the next enroll would incorrectly allocate UID 1 over the real terminal users.
    if (livePins.length === 0) {
      this.logger.warn(
        'reconcileDeletedAgainstLivePins skipped — empty live pin list',
      );
      return;
    }

    const live = new Set(livePins.map((p) => String(p).trim()));
    const allDbUsers = await this.deviceUserRepo.find();
    for (const dbUser of allDbUsers) {
      if (!live.has(dbUser.deviceUid) && dbUser.status !== DeviceUserStatus.DELETED) {
        dbUser.status = DeviceUserStatus.DELETED;
        await this.deviceUserRepo.save(dbUser);
        this.logger.log(
          `Device user marked as deleted: uid=${dbUser.deviceUid} (absent from live device dump)`,
        );
      }
    }
  }

  private invalidateLivePinsCache(): void {
    this.livePinsCache = null;
  }

  /** Reserve a UID for an in-flight cloud registration, with a hard expiry. */
  private markCloudRegistrationPending(deviceUid: string): void {
    this.pendingCloudRegistrationUids.set(
      deviceUid,
      Date.now() + DeviceUserService.PENDING_ENROLL_TTL_MS,
    );
  }

  private isCloudRegistrationPending(deviceUid: string): boolean {
    const expiresAt = this.pendingCloudRegistrationUids.get(deviceUid);
    if (expiresAt == null) return false;
    if (Date.now() > expiresAt) {
      this.pendingCloudRegistrationUids.delete(deviceUid);
      return false;
    }
    return true;
  }

  /**
   * Drop every reservation for a UID. Called whenever the UID's enrollment is
   * finished, cancelled, or the owning employee is removed — otherwise the UID
   * stays "occupied" in memory and the next allocation skips over it.
   */
  private releaseReservation(deviceUid: string): void {
    this.pendingEnrollByPin.delete(deviceUid);
    this.pendingCloudRegistrationUids.delete(deviceUid);
    this.cancelEnrollmentFallback(deviceUid);
  }

  /**
   * Enrollment completion for terminals that never push the template.
   *
   * The F18 pushes the saved template (FP/BIODATA table) and that is the reliable
   * "finger stored" signal. Push-2.4 firmware such as the M2-LR writes the enrollment
   * to OPERLOG and pushes nothing else — no FP, no BIODATA — so waiting for a template
   * leaves the admin staring at the modal forever.
   *
   * OPERLOG alone is too early on the F18 (it arrives before the template is saved), so
   * this waits a grace period first. If the template lands in that window the normal path
   * completes and clears the reservation, and this becomes a no-op.
   */
  noteBiometricOperation(deviceUid: string, deviceSerial: string | null): void {
    if (!this.getPendingEnrollment(deviceUid)) return;
    if (this.enrollmentFallbackTimers.has(deviceUid)) return;

    const scope = tenantStorage.getStore();
    const timer = setTimeout(() => {
      const work = () => this.completeEnrollmentFromOperationLog(deviceUid, deviceSerial);
      void (scope && this.tenantJobs
        ? this.tenantJobs.forDevice(scope.tenantId, scope.branchId!, scope.deviceId!, 'enrollment-fallback', work)
        : work()).catch(error => this.logger.error('Enrollment fallback failed', error));
    }, DeviceUserService.TEMPLATE_PUSH_GRACE_MS);
    timer.unref?.();
    this.enrollmentFallbackTimers.set(deviceUid, timer);
  }

  private cancelEnrollmentFallback(deviceUid: string): void {
    const timer = this.enrollmentFallbackTimers.get(deviceUid);
    if (!timer) return;
    clearTimeout(timer);
    this.enrollmentFallbackTimers.delete(deviceUid);
  }

  private async completeEnrollmentFromOperationLog(
    deviceUid: string,
    deviceSerial: string | null,
  ): Promise<void> {
    this.enrollmentFallbackTimers.delete(deviceUid);
    // Already completed by a template push — nothing to do.
    if (!this.getPendingEnrollment(deviceUid)) return;

    const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid } });
    this.logger.warn(
      `No fingerprint template pushed by ${deviceSerial ?? 'device'} for pin=${deviceUid} ` +
      `within ${DeviceUserService.TEMPLATE_PUSH_GRACE_MS / 1000}s — completing enrollment from OPERLOG.`,
    );
    await this.tryCompletePendingEnrollment(deviceUid, deviceUser?.name ?? null);
  }

  /** Purge timed-out reservations so they stop counting as occupied UIDs. */
  private sweepExpiredReservations(): void {
    const now = Date.now();
    for (const [pin, pending] of this.pendingEnrollByPin) {
      if (now > pending.expiresAt) {
        this.pendingEnrollByPin.delete(pin);
        this.logger.debug(`Released expired enrollment reservation pin=${pin}`);
      }
    }
    for (const [pin, expiresAt] of this.pendingCloudRegistrationUids) {
      if (now > expiresAt) {
        this.pendingCloudRegistrationUids.delete(pin);
        this.logger.debug(`Released expired cloud registration reservation pin=${pin}`);
      }
    }
  }

  private getPendingEnrollment(deviceUid: string): { employeeId: string } | null {
    const pending = this.pendingEnrollByPin.get(deviceUid);
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) {
      this.pendingEnrollByPin.delete(deviceUid);
      return null;
    }
    return { employeeId: pending.employeeId };
  }

  private async tryCompletePendingEnrollment(
    deviceUid: string,
    name: string | null,
  ): Promise<boolean> {
    const pending = this.getPendingEnrollment(deviceUid);
    if (!pending) return false;

    try {
      await this.linkToEmployee(deviceUid, pending.employeeId);
      this.releaseReservation(deviceUid);

      this.biometricGateway.emitEnrollmentCompleted({
        employeeId: pending.employeeId,
        deviceUid,
        name,
      });
      this.biometricGateway.emitEnrollmentStatus({
        employeeId: pending.employeeId,
        deviceUid,
        status: 'completed',
      });
      this.logger.log(
        `Auto-linked enrollment pin=${deviceUid} → employee=${pending.employeeId}`,
      );
      return true;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to auto-link enrollment pin=${deviceUid}: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.biometricGateway.emitEnrollmentStatus({
        employeeId: pending.employeeId,
        deviceUid,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Link failed',
      });
      return false;
    }
  }

  async findOne(deviceUid: string): Promise<DeviceUser> {
    const user = await this.deviceUserRepo.findOne({ where: { deviceUid } });
    if (!user) {
      throw new NotFoundException(`Device user '${deviceUid}' not found`);
    }
    return user;
  }

  async linkToEmployee(deviceUid: string, employeeId: string): Promise<DeviceUser> {
    const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid } });
    if (!deviceUser) {
      throw new NotFoundException(`Device user '${deviceUid}' not found`);
    }

    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }

    // Prevent linking if employee already has a different fingerprint linked
    if (employee.fingerprintCode && employee.fingerprintCode !== deviceUid) {
      throw new ConflictException(
        `Employee '${employee.name}' is already linked to a different device (${employee.fingerprintCode}). ` +
        `Please unlink the old device first.`,
      );
    }

    const alreadyLinked = await this.deviceUserRepo.findOne({
      where: { linkedEmployeeId: employeeId, status: DeviceUserStatus.LINKED },
    });
    if (alreadyLinked && alreadyLinked.deviceUid !== deviceUid) {
      throw new ConflictException(
        `Employee '${employee.name}' is already linked to device uid '${alreadyLinked.deviceUid}'`,
      );
    }

    deviceUser.linkedEmployeeId = employeeId;
    deviceUser.status = DeviceUserStatus.LINKED;

    employee.fingerprintCode = deviceUid;
    await this.employeeRepo.save(employee);

    return this.deviceUserRepo.save(deviceUser);
  }

  async deleteAllUnlinkedDeviceUsers(): Promise<{ deleted: number; failed: number }> {
    const unlinked = await this.findUnlinked();
    let deleted = 0;
    let failed = 0;

    for (const user of unlinked) {
      // Defensive guard: skip any user that still has a linkedEmployeeId set, even if
      // its status shows UNLINKED. A status/linkedEmployeeId mismatch indicates a data
      // inconsistency — deleting it here would silently break the employee's link.
      if (user.linkedEmployeeId) {
        this.logger.warn(
          `deleteAllUnlinked: skipping uid=${user.deviceUid} — linkedEmployeeId is set (status mismatch, not deleting)`,
        );
        continue;
      }
      try {
        await this.zkTecoService.deleteUser(user.deviceUid);
        deleted++;
      } catch {
        failed++;
      }
      user.status = DeviceUserStatus.DELETED;
      user.linkedEmployeeId = null;
      await this.deviceUserRepo.save(user);
      // The UID is free again — drop any reservation so the next enroll can reuse it.
      this.releaseReservation(user.deviceUid);
    }

    if (deleted > 0 || failed > 0) {
      this.invalidateLivePinsCache();
    }

    return { deleted, failed };
  }

  async deleteDeviceUser(
    deviceUid: string,
    options?: { requireDeviceDeletion?: boolean },
  ): Promise<void> {
    const normalizedUid = deviceUid.trim();
    const requireDeviceDeletion = options?.requireDeviceDeletion ?? false;
    const deviceUser = await this.deviceUserRepo.findOne({ where: { deviceUid: normalizedUid } });

    await this.removeFromPhysicalDevice(normalizedUid, requireDeviceDeletion);
    await this.clearFingerprintCode(normalizedUid, deviceUser?.linkedEmployeeId ?? null);
    // The UID is free again — drop any reservation so the next enroll can reuse it.
    this.releaseReservation(normalizedUid);
    this.invalidateLivePinsCache();

    if (!deviceUser) {
      return;
    }

    deviceUser.status = DeviceUserStatus.DELETED;
    deviceUser.linkedEmployeeId = null;
    await this.deviceUserRepo.save(deviceUser);
  }

  async unlinkEmployee(deviceUid: string): Promise<DeviceUser> {
    const deviceUser = await this.findOne(deviceUid);

    if (deviceUser.linkedEmployeeId) {
      const employee = await this.employeeRepo.findOne({
        where: { id: deviceUser.linkedEmployeeId },
      });
      if (employee) {
        employee.fingerprintCode = null;
        await this.employeeRepo.save(employee);
      }
    }

    deviceUser.linkedEmployeeId = null;
    deviceUser.status = DeviceUserStatus.UNLINKED;
    return this.deviceUserRepo.save(deviceUser);
  }

  /**
   * Public entry point for the ADMS cloud push path.
   * Called by IclockService when the ZKTeco device pushes ATTLOG / OPERLOG / USERINFO.
   * Idempotent: creates a new UNLINKED device user or restores a deleted one,
   * and repairs any broken employee link — identical to the TCP sync path.
   */
  async upsertFromCloud(
    deviceUid: string,
    name: string | null,
    options?: { emitModal?: boolean; markPending?: boolean; emitForPendingOnly?: boolean; deviceSerial?: string | null },
  ): Promise<void> {
    // During an occupancy dump, only record PINs — never open the link modal or
    // mark every existing device user as a "new registration".
    if (this.cloudUserQuery) {
      const pin = deviceUid.trim();
      this.cloudUserQuery.pins.add(pin);
      await this.upsertDeviceUser(pin, name, {
        ...options,
        emitModal: false,
        markPending: false,
        emitForPendingOnly: false,
      });
      return;
    }

    await this.upsertDeviceUser(deviceUid, name, options);
  }

  private async clearFingerprintCode(
    deviceUid: string,
    linkedEmployeeId: string | null,
  ): Promise<void> {
    if (linkedEmployeeId) {
      const employee = await this.employeeRepo.findOne({ where: { id: linkedEmployeeId } });
      if (employee && employee.fingerprintCode === deviceUid) {
        employee.fingerprintCode = null;
        await this.employeeRepo.save(employee);
      }
      return;
    }

    const employee = (null as Employee | null);
    if (!employee) {
      return;
    }

    employee.fingerprintCode = null;
    await this.employeeRepo.save(employee);
  }

  private async removeFromPhysicalDevice(
    deviceUid: string,
    requireDeviceDeletion: boolean,
  ): Promise<void> {
    const sn = this.zkTecoService.getCloudCommandSn() ?? this.zkTecoService.getCloudDeviceSn();
    if (sn) {
      try {
        await this.admsCommands.enqueueAndAwait(sn, `DATA DELETE USERINFO PIN=${deviceUid}`);
        this.logger.log(`ADMS delete confirmed for uid=${deviceUid} sn=${sn}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (requireDeviceDeletion) {
          throw new BadRequestException(
            `Could not delete employee from ZKTeco device: ${msg}`,
          );
        }
        this.logger.warn(`ADMS delete failed for uid=${deviceUid}: ${msg}`);
      }
      return;
    }

    if (!this.zkTecoService.isEnabled()) {
      const message = 'ZKTeco is not connected (no ADMS cloud session and TCP is disabled)';

      if (requireDeviceDeletion) {
        throw new BadRequestException(message);
      }

      this.logger.warn(message);
      return;
    }

    if (!this.zkTecoService.isConnected()) {
      if (requireDeviceDeletion) {
        throw new BadRequestException(
          'ZKTeco device is not connected. Connect the device and try again.',
        );
      }

      this.logger.warn(`Skipping physical delete for uid=${deviceUid} because the device is offline`);
      return;
    }

    try {
      await this.zkTecoService.deleteUser(deviceUid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const missingOnDevice = msg.includes('not found on device') || await this.isMissingOnDevice(deviceUid);

      if (missingOnDevice) {
        this.logger.warn(`uid=${deviceUid} is already absent on the device`);
        return;
      }

      if (requireDeviceDeletion) {
        throw new BadRequestException(`Could not delete uid=${deviceUid} from device: ${msg}`);
      }

      this.logger.warn(`Could not delete uid=${deviceUid} from device: ${msg}`);
    }
  }

  private async removeFingerprintFromPhysicalDevice(
    deviceUid: string,
    requireDeviceDeletion: boolean,
  ): Promise<void> {
    const sn = this.zkTecoService.getCloudCommandSn() ?? this.zkTecoService.getCloudDeviceSn();
    if (sn) {
      try {
        await this.admsCommands.enqueueAndAwait(sn, `DATA DELETE FINGERTMP PIN=${deviceUid}`);
        this.logger.log(`ADMS fingerprint delete confirmed for uid=${deviceUid} sn=${sn}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (requireDeviceDeletion) {
          throw new BadRequestException(
            `Could not remove fingerprint from ZKTeco device: ${msg}`,
          );
        }
        this.logger.warn(`ADMS fingerprint delete failed for uid=${deviceUid}: ${msg}`);
      }
      return;
    }

    if (!this.zkTecoService.isEnabled()) {
      const message = 'ZKTeco is not connected (no ADMS cloud session and TCP is disabled)';

      if (requireDeviceDeletion) {
        throw new BadRequestException(message);
      }

      this.logger.warn(message);
      return;
    }

    if (!this.zkTecoService.isConnected()) {
      if (requireDeviceDeletion) {
        throw new BadRequestException(
          'ZKTeco device is not connected. Connect the device and try again.',
        );
      }

      this.logger.warn(
        `Skipping fingerprint delete for uid=${deviceUid} because the device is offline`,
      );
      return;
    }

    try {
      await this.zkTecoService.deleteUserFingerprints(deviceUid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (requireDeviceDeletion) {
        throw new BadRequestException(
          `Could not remove fingerprint from ZKTeco device: ${msg}`,
        );
      }

      this.logger.warn(`Could not delete fingerprint templates for uid=${deviceUid}: ${msg}`);
    }
  }

  private async isMissingOnDevice(deviceUid: string): Promise<boolean> {
    if (!this.zkTecoService.isEnabled() || !this.zkTecoService.isConnected()) {
      return false;
    }

    const users = await this.zkTecoService.getUsers();
    return !users.some((user) => String(user.userId) === deviceUid);
  }
}
