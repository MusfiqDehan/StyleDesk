import { SocketTenantAuth } from '../tenancy/socket-tenant-auth.js';
import { afterCommit, requireScope } from '../tenancy/tenant-context.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth } from '../auth/entities/auth.entity.js';
import { isAllowedOriginAsync } from '../common/allowed-origin.js';
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../auth/entities/auth.entity.js';

type SocketUser = {
  id?: string;
  tokenVersion?: number;
  exp?: number;
  role?: string;
  permissions?: string[];
  isCustomer?: boolean;
};

function parseCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function canReceiveAdminNotifications(user: SocketUser): boolean {
  if (!user?.role || user.isCustomer || user.role === UserRole.CUSTOMER) return false;
  if (user.role === UserRole.ADMIN || user.role === UserRole.STORE_MANAGER) return true;
  if (user.role === UserRole.STAFF || user.role === UserRole.STYLIST) return true;
  if (user.role === UserRole.CUSTOM) {
    return (user.permissions || []).includes('appointments');
  }
  return false;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      void isAllowedOriginAsync(origin).then(allowed=>callback(null,allowed)).catch(()=>callback(null,false));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowRequest: (request, callback) => {void isAllowedOriginAsync(request.headers.origin).then(allowed=>callback(null,allowed)).catch(()=>callback(null,false));},
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly socketAuth: SocketTenantAuth) {}

  afterInit() {
    this.logger.log('NotificationGateway initialized (auth required)');
  }

  async handleConnection(client: Socket) {
    try { await this.socketAuth.authenticate(client); }
    catch { client.disconnect(true); }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  emitNewAppointment(payload: any): void {
    if (!this.server) {
      this.logger.warn('Cannot emit new-appointment: server not initialized');
      return;
    }
    this.logger.log(
      `Emitting new-appointment to admin-notifications. Payload ID: ${payload?.id}, clientName: ${payload?.clientName}`,
    );
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:appointments`;
    afterCommit(() => { this.server.to(room).emit('new-appointment', payload); });
  }

  emitNewInvoice(payload: { id: string }): void {
    if (!this.server) {
      this.logger.warn('Cannot emit new-invoice: server not initialized');
      return;
    }
    this.logger.log(`Emitting new-invoice to admin-notifications. Payload ID: ${payload?.id}`);
    const scope = requireScope();
    const room = `tenant:${scope.tenantId}:branch:${scope.branchId}:notifications:invoice`;
    afterCommit(() => { this.server.to(room).emit('new-invoice', payload); });
  }
}
