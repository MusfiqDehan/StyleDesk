import { RolesGuard } from './roles.guard';
import { AuthService } from './auth.service';
import { UserRole } from './entities/auth.entity';
function context(role: UserRole, accessEnforced: boolean) {
  return {getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>({user:{role},accessEnforced})})} as any;
}
describe('Permission-based tenant access',()=>{
  const reflector = {getAllAndOverride:jest.fn().mockImplementation(key=>key==='isPublic' ? false : [UserRole.ADMIN])};
  it('honors an action already authorized by the tenant access guard for custom accounts',()=>{
    expect(new RolesGuard(reflector as any).canActivate(context(UserRole.CUSTOM,true))).toBe(true);
  });
  it('keeps role restrictions when action authorization has not run',()=>{
    expect(()=>new RolesGuard(reflector as any).canActivate(context(UserRole.CUSTOM,false))).toThrow();
  });
  it('does not admit customers through the authorized-role path',()=>{
    expect(()=>new RolesGuard(reflector as any).canActivate(context(UserRole.CUSTOMER,true))).toThrow();
  });
  it('rejects inactive accounts before issuing a login token',async()=>{
    const service=Object.create(AuthService.prototype);
    service.authRepository={findOne:async()=>({active:false,password:'unused'})};
    await expect(service.login({useremail:'inactive@example.test',password:'unused'})).rejects.toThrow('Invalid credentials');
  });
});
