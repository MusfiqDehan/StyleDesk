import { tenantStorage } from '../tenancy/tenant-context';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PublicLoginDto, ResetPasswordDto } from './dto/auth-request.dto';
import { isAllowedOrigin } from '../common/allowed-origin';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('Authentication security regressions', () => {
  const repo = { findOne: jest.fn(), save: jest.fn() };
  const config = { get: jest.fn((key: string) => key === 'JWT_SECRET' ? 'test-secret-for-security-regressions' : '10') };
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => tenantStorage.disable());

  it('rejects deleted accounts, changed roles and revoked tokens', async () => tenantStorage.run({ tenantId: 'tenant-a', branchId: 'branch-a', runner: { isReleased: false } as any, afterCommit: [] }, async () => {
    const strategy = new JwtStrategy(config as any, repo as any, { findOne: jest.fn() } as any);
    const payload = { tenantId: 'tenant-a', id: 'account-id', useremail: 'test@example.com', role: 'admin', tokenVersion: 1 };
    repo.findOne.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow();
    repo.findOne.mockResolvedValue({ role: 'staff', tokenVersion: 1 });
    await expect(strategy.validate(payload)).rejects.toThrow();
    repo.findOne.mockResolvedValue({ role: 'admin', tokenVersion: 2 });
    await expect(strategy.validate(payload)).rejects.toThrow();
    repo.findOne.mockResolvedValue({ role: 'admin', tenantId: 'tenant-a', tokenVersion: 1, active: true });
    await expect(strategy.validate(payload)).resolves.toMatchObject({ id: 'account-id' });
    expect(repo.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ loadEagerRelations: false }));
  }));

  it('revokes old sessions after a password change', async () => {
    const account = { password: 'old-hash', tokenVersion: 4 };
    repo.findOne.mockResolvedValue(account);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    const service = new AuthService(repo as any, {} as any, {} as any, {} as any, {} as any, config as any, {} as any, {} as any);
    await service.updatePassword('id', { oldPassword: 'old-password', newPassword: 'new-password' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ password: 'new-hash', tokenVersion: 5 }));
  });

  it('revokes old sessions after a password reset', async () => {
    const account = { resetCode: '123456', resetCodeExpiry: new Date(Date.now() + 60000), tokenVersion: 2 };
    repo.findOne.mockResolvedValue(account);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    const service = new AuthService(repo as any, {} as any, {} as any, {} as any, {} as any, config as any, {} as any, {} as any);
    await service.resetPassword('test@example.com', '123456', 'new-password');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 3, resetCode: null }));
  });

  it('rejects malformed login and reset inputs before reaching bcrypt', async () => {
    expect(await validate(plainToInstance(PublicLoginDto, { email: {}, password: [] }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(ResetPasswordDto, { email: 'a@b.com', code: '123456', newPassword: '' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(ResetPasswordDto, { email: 'a@b.com', code: '123456', newPassword: 'valid-password' }))).toHaveLength(0);
  });

  it('does not attach an existing client to a different verified email', async () => {
    const runner = { connect: jest.fn(), startTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(), manager: { findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'client', email: 'owner@example.com' }) } };
    const controller = new AuthController({ assertSignupEmailVerified: jest.fn() } as any, {} as any, { createQueryRunner: () => runner } as any, config as any);
    await tenantStorage.run({tenantId:'tenant-a',branchId:'branch-a',runner:{isReleased:false,query:async()=>[{state:{active:true,emailVerified:true,status:'active'}}]} as any,afterCommit:[]},async()=>expect(controller.registerCustomer({ email: 'attacker@example.com', phone: '01700000000', name: 'Test', password: 'password' })).rejects.toThrow('existing client'));
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('rejects arbitrary browser origins', () => {
    expect(isAllowedOrigin('https://untrusted.invalid')).toBe(false);
  });
});
