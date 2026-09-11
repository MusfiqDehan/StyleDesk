import { Injectable, BadRequestException } from '@nestjs/common';
import { ZKTecoService } from '../biometric/zkteco.service.js';
import { requireScope, afterCommit } from '../tenancy/tenant-context.js';
import { isPrivateOrLoopbackIp } from '../common/is-private-ip.js';
@Injectable()
export class DeviceDiscoveryService {
  constructor(private readonly zkTecoService: ZKTecoService) {}
  getStatus() {
    return { enabled: false, manualOverride: null, discoveredIp: null, scanning: false, lastScanAt: null, lastFoundAt: null, connected: this.zkTecoService.isConnected() };
  }
  async triggerRescan() { return { triggered: false, message: 'Network discovery is disabled. Configure a registered device endpoint.' }; }
  async setManualOverride(ip: string) {
    if (!isPrivateOrLoopbackIp(ip)) throw new BadRequestException('Device endpoint must be private/LAN');
    const scope = requireScope();
    if (!scope.deviceId) throw new BadRequestException('Select a registered device');
    await scope.runner.query('UPDATE registered_device SET host=$1 WHERE id=$2', [ip, scope.deviceId]);
    return { applied: true, message: 'Device endpoint saved; scoped polling will reconnect.' };
  }
  async clearManualOverride() {
    const scope = requireScope();
    if (!scope.deviceId) throw new BadRequestException('Select a registered device');
    await scope.runner.query('UPDATE registered_device SET host=NULL WHERE id=$1', [scope.deviceId]);
    return { cleared: true, previous: null };
  }
}
