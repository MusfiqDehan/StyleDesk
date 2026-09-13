import { Controller, Get, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator.js';
import { AdmsCommandQueue } from '../biometric/adms-command.queue.js';
import { IclockAuthGuard } from './iclock-auth.guard.js';
import { IclockService } from './iclock.service.js';

/**
 * ZKTeco ADMS (iClock) cloud push endpoint.
 *
 * Device (Setup → Cloud Server / ADMS):
 *   Domain Name / Server : <public-host-or-ip>   (path is always /iclock — do not put ?key=)
 *   Server Port          : <port your Nest/nginx listens on>
 *   Enable Domain Name   : Yes
 *
 * Register the serial to one tenant/branch through the operator command.
 * A trusted device proxy must inject its per-registration x-iclock-key, or the
 * registration must explicitly permit the exact incoming source IP.
 * A serial number alone does not authenticate the device.
 */
@Public()
@SkipThrottle({ default: true })
@UseGuards(IclockAuthGuard)
@Controller('iclock')
export class IclockController {
  private readonly logger = new Logger(IclockController.name);

  constructor(
    private readonly iclockService: IclockService,
    private readonly admsCommands: AdmsCommandQueue,
  ) {}

  @Get('cdata')
  handshake(
    @Query('SN') sn: string,
    @Query('pushver') pushver: string,
    @Query('options') options: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const serial = sn?.trim() || 'UNKNOWN';
    const version = pushver?.trim() || '';
    this.logger.log(
      `ADMS handshake SN=${serial}${version ? ` pushver=${version}` : ''}` +
      `${options?.trim() ? ` options=${options.trim()}` : ''} from ${req.ip ?? 'unknown'}`,
    );
    this.iclockService.recordHeartbeat(serial);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const dateStr =
      `${dhaka.getUTCFullYear()}-${pad(dhaka.getUTCMonth() + 1)}-${pad(dhaka.getUTCDate())} ` +
      `${pad(dhaka.getUTCHours())}:${pad(dhaka.getUTCMinutes())}:${pad(dhaka.getUTCSeconds())}`;

    const body = this.supportsPush24(version)
      ? this.push24Options(serial, dateStr)
      : this.legacyOptions(dateStr);

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(200).send(body);
  }

  /** True for firmware announcing push protocol 2.4 or newer (M2-LR and later). */
  private supportsPush24(pushver: string): boolean {
    const match = pushver.match(/^(\d+)\.(\d+)/);
    if (!match) return false;
    const [major, minor] = [Number(match[1]), Number(match[2])];
    return major > 2 || (major === 2 && minor >= 4);
  }

  /** The reply the F18 and other pre-2.4 firmwares expect — unchanged. */
  private legacyOptions(dateStr: string): string {
    return (
      `OK\r\n` +
      `Date:${dateStr}\r\n` +
      // Minimal poll delay so ENROLL_FP reaches the device ASAP after Register.
      `Delay=0\r\n` +
      `ErrorDelay=1\r\n` +
      `TransInterval=0\r\n` +
      `Realtime=1\r\n` +
      `Encrypt=0\r\n` +
      `TransFlag=TransData AttLog\tOpLog\tAttPhoto\tEnrollUser\tChgUser\tEnrollFP\tChgFP\tFP\r\n` +
      `ATTLOGStamp=0\r\n` +
      `OPERLOGStamp=0\r\n` +
      `USERINFOStamp=0\r\n` +
      `ATTPHOTOStamp=0\r\n`
    );
  }

  /**
   * Push protocol 2.4+ option block. It must open with `GET OPTION FROM:` and declare
   * which biometric types the server accepts — a multi-biometric terminal will not upload
   * templates (the BIODATA table) to a server that never advertises MultiBioDataSupport,
   * which is why the M2-LR only ever pushed OPERLOG.
   */
  private push24Options(serial: string, dateStr: string): string {
    return (
      `GET OPTION FROM: ${serial}\r\n` +
      `Date:${dateStr}\r\n` +
      `Stamp=0\r\n` +
      `OpStamp=0\r\n` +
      `PhotoStamp=0\r\n` +
      `ErrorDelay=1\r\n` +
      `Delay=0\r\n` +
      `TransTimes=00:00;14:00\r\n` +
      `TransInterval=0\r\n` +
      `TransFlag=TransData AttLog\tOpLog\tAttPhoto\tEnrollUser\tChgUser\tEnrollFP\tChgFP\tFP\tBioData\tBioPhoto\r\n` +
      `TimeZone=6\r\n` +
      `Realtime=1\r\n` +
      `Encrypt=0\r\n` +
      `ServerVer=2.4.1\r\n` +
      `PushProtVer=2.4.1\r\n` +
      `PushOptionsFlag=1\r\n` +
      // One flag per biometric type (0–9): accept every template the terminal can produce.
      `MultiBioDataSupport=1:1:1:1:1:1:1:1:1:1\r\n` +
      `MultiBioPhotoSupport=0:0:0:0:0:0:0:0:0:0\r\n` +
      `ATTLOGStamp=0\r\n` +
      `OPERLOGStamp=0\r\n` +
      `USERINFOStamp=0\r\n` +
      `BIODATAStamp=0\r\n` +
      `ATTPHOTOStamp=0\r\n`
    );
  }

  @Post('cdata')
  data(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const serial = sn?.trim() || 'UNKNOWN';
    // Push protocol 2.4+ (M2-LR and other recent firmwares) names the table in the
    // query string only — the body carries bare rows with no `table=` header.
    const tableParam = table?.trim() || '';
    this.logger.log(
      `ADMS data push SN=${serial}${tableParam ? ` table=${tableParam}` : ''} from ${req.ip ?? 'unknown'}`,
    );

    let raw = '';
    try {
      if (Buffer.isBuffer(req.body)) {
        raw = req.body.toString('utf-8');
      } else if (typeof req.body === 'string') {
        raw = req.body;
      } else if (req.body && typeof req.body === 'object') {
        raw = Object.entries(req.body as Record<string, unknown>)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('\n');
      }
    } catch {
      raw = '';
    }

    this.iclockService.processPush(serial, raw, tableParam).catch((err: unknown) => {
      this.logger.error(
        `processPush error SN=${serial}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(200).send('OK\n');
  }

  @Get('getrequest')
  getRequest(
    @Query('SN') sn: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    void _req;
    const serial = sn?.trim() || '';
    if (serial) this.iclockService.recordHeartbeat(serial);

    const command = serial ? this.admsCommands.dequeueForDevice(serial) : null;
    if (command) {
      this.logger.log(`getrequest SN=${serial} →\n${command}`);
    }
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    // ZKTeco ADMS expects CRLF; end with a blank line after the last command.
    if (command) {
      return res.status(200).send(`${command}\r\n`);
    }
    // No pending cmds — ask for an immediate re-poll.
    return res.status(200).send('OK\r\nDelay=0\r\n');
  }

  @Post('devicecmd')
  deviceCmd(
    @Query('SN') sn: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const serial = sn?.trim() || '';
    if (serial) this.iclockService.recordHeartbeat(serial);

    let raw = '';
    try {
      if (Buffer.isBuffer(req.body)) {
        raw = req.body.toString('utf-8');
      } else if (typeof req.body === 'string') {
        raw = req.body;
      } else if (req.body && typeof req.body === 'object') {
        raw = Object.entries(req.body as Record<string, unknown>)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('&');
      }
    } catch {
      raw = '';
    }

    if (serial && raw) this.admsCommands.acknowledge(serial, raw);

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(200).send('OK\n');
  }
}
