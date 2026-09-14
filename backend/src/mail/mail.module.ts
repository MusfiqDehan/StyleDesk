import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { BussinessInfoModule } from '../bussiness-info/bussiness-info.module.js';

@Module({
    imports: [BussinessInfoModule],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }
