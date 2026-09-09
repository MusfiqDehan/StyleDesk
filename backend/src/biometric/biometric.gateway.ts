import { SocketTenantAuth } from '../tenancy/socket-tenant-auth.js';
import { afterCommit, requireScope } from '../tenancy/tenant-context.js';
import { isAllowedOriginAsync } from '../common/allowed-origin.js';
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface NewDeviceUserPayload {
  id: string;
  device_uid: string;
  name: string | null;
}

export interface AttendanceUpdatedPayload {
  refreshedAt: string;
  attendanceDates: string[];
  deviceUserIds: string[];
}

export interface UnlinkedFingerprintScannedPayload {
  deviceUserId: string;
  name: string | null;
  attendanceDate: string; // YYYY-MM-DD business date of the triggering scan
}

export interface EnrollmentCompletedPayload {
  employeeId: string;
  deviceUid: string;
  name: string | null;
}

export interface EnrollmentStatusPayload {
  employeeId: string;
  deviceUid: string;
  status: 'waiting' | 'completed' | 'failed';
  message?: string;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      void isAllowedOriginAsync(origin).then(allowed=>callback(null,allowed)).catch(()=>callback(null,false));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class BiometricGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(BiometricGateway.name);

  constructor(private readonly socketAuth: SocketTenantAuth) {}

  afterInit() {
    this.logger.log('BiometricGateway initialized');
  }

  async handleConnection(client: Socket) {
    try { await this.socketAuth.authenticate(client); } catch { client.disconnect(true); }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  emitNewDeviceUser(payload: NewDeviceUserPayload): void {
    this.logger.log(`Emitting new-device-user: uid=${payload.device_uid}`);
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:attendance`;
    afterCommit(() => { this.server.to(room).emit('new-device-user', payload); });
  }

  emitAttendanceUpdated(payload: AttendanceUpdatedPayload): void {
    this.logger.log(`Emitting attendance-updated for ${payload.deviceUserIds.length} device user(s)`);
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:attendance`;
    afterCommit(() => { this.server.to(room).emit('attendance-updated', payload); });
  }

  emitUnlinkedFingerprintScanned(payload: UnlinkedFingerprintScannedPayload): void {
    this.logger.log(`Emitting unlinked-fingerprint-scanned: uid=${payload.deviceUserId}`);
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:attendance`;
    afterCommit(() => { this.server.to(room).emit('unlinked-fingerprint-scanned', payload); });
  }

  emitEnrollmentStatus(payload: EnrollmentStatusPayload): void {
    this.logger.log(
      `Emitting enrollment-status: employee=${payload.employeeId} uid=${payload.deviceUid} status=${payload.status}`,
    );
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:attendance`;
    afterCommit(() => { this.server.to(room).emit('enrollment-status', payload); });
  }

  emitEnrollmentCompleted(payload: EnrollmentCompletedPayload): void {
    this.logger.log(
      `Emitting enrollment-completed: employee=${payload.employeeId} uid=${payload.deviceUid}`,
    );
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:attendance`;
    afterCommit(() => { this.server.to(room).emit('enrollment-completed', payload); });
  }

  getConnectedClients(): number {
    return this.server?.sockets?.sockets?.size ?? 0;
  }
}
