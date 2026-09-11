import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZKTecoService } from '../biometric/zkteco.service.js';
import { UpdateDeviceConfigDto } from './dto/update-device-config.dto.js';
import { DeviceNetworkConfig } from './entities/device-network-config.entity.js';
import { DeviceConfigLog } from './entities/device-config-log.entity.js';
import { requireScope } from '../tenancy/tenant-context.js';
export interface AutoSyncResult { changed: boolean; message: string; detected?: Record<string,string|null>; changes?: Record<string,string> }
@Injectable()
export class DeviceConfigService {
  constructor(
    @InjectRepository(DeviceNetworkConfig) private readonly configRepo: Repository<DeviceNetworkConfig>,
    @InjectRepository(DeviceConfigLog) private readonly logRepo: Repository<DeviceConfigLog>,
    private readonly zkTecoService: ZKTecoService,
  ) {}
  async getConfig(): Promise<DeviceNetworkConfig> {
    const scope = requireScope();
    if (!scope.deviceId) throw new BadRequestException('Register and select an attendance device');
    const existing = await this.configRepo.findOne({where:{}});
    if (existing) return existing;
    const [device] = await scope.runner.query('SELECT host,port FROM registered_device WHERE id=$1 AND active',[scope.deviceId]);
    if (!device) throw new BadRequestException('Unknown device');
    return this.configRepo.save(this.configRepo.create({deviceIp:device.host ?? '',devicePort:device.port}));
  }
  async getFullStatus() {
    return {config:await this.getConfig(),connected:this.zkTecoService.isConnected(),enabled:this.zkTecoService.isEnabled(),liveDevice:null};
  }
  async saveAndApply(dto: UpdateDeviceConfigDto) {
    const scope = requireScope();
    const record = await this.getConfig();
    const oldValues = {...record};
    Object.assign(record,dto);
    const config = await this.configRepo.save(record);
    await scope.runner.query('UPDATE registered_device SET host=$1,port=$2 WHERE id=$3',[dto.deviceIp,dto.devicePort,scope.deviceId]);
    // Network operations run in the next scoped device job, after this transaction commits.
    await this.logRepo.save(this.logRepo.create({action:'manual_update',oldValues,newValues:{...config},result:'success'} as any));
    return {config};
  }
  async autoSync(): Promise<AutoSyncResult> { return {changed:false,message:'Server-network auto detection is disabled. Configure the selected device explicitly.'}; }
  async getLogs(limit = 30) { return this.logRepo.find({order:{createdAt:'DESC'},take:Math.max(1,Math.min(100,Number.isFinite(limit) ? limit : 30))}); }
}
