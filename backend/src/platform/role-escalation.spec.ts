import { UserManagementService } from '../user-management/user-management.service.js';
import { UserRole } from '../auth/entities/auth.entity.js';
import { TenantConsoleService } from './tenant-console.service.js';
import { tenantStorage } from '../tenancy/tenant-context.js';

describe('Role assignment boundaries', () => {
  const actor = {
    id: 'actor',
    role: UserRole.CUSTOM,
    branchId: 'home',
    branchScope: 'home',
    permissions: [
      'user-management:edit',
      'user-management:manage',
      'user-management:invite',
    ],
  };
  function users(target: any) {
    return new UserManagementService(
      { findOne: async () => target, save: jest.fn() } as any,
      {} as any,
    );
  }
  it('prevents delegated account editors from resetting owner credentials', async () => {
    await expect(
      users({ id: 'owner', role: UserRole.ADMIN }).update(
        'owner',
        { password: 'new-password' },
        actor,
      ),
    ).rejects.toThrow('Owner accounts');
  });
  it('prevents legacy preset promotion through the account editor', async () => {
    await expect(
      users({
        id: 'staff',
        role: UserRole.CUSTOM,
        branchId: 'home',
        permissions: [],
      }).update('staff', { role: UserRole.STORE_MANAGER }, actor),
    ).rejects.toThrow('authorized named roles');
  });
  it('prevents edits to another branch or a more privileged account', async () => {
    await expect(
      users({
        role: UserRole.CUSTOM,
        branchId: 'other',
        permissions: [],
      }).update('other', {}, actor),
    ).rejects.toThrow('Home branch');
    await expect(
      users({
        role: UserRole.CUSTOM,
        branchId: 'home',
        permissions: ['finance:delete'],
      }).update('higher', {}, actor),
    ).rejects.toThrow('more privileged');
  });
  it('prevents home-branch inviters from granting a tenant-wide role', async () => {
    const console = new TenantConsoleService(
      {} as any,
      { require: async () => {} } as any,
    );
    await tenantStorage.run(
      {
        tenantId: 'tenant',
        branchId: 'home',
        runner: {
          isReleased: false,
          query: async () => [
            {
              id: 'role',
              branch_scope: 'tenant',
              permissions: actor.permissions,
            },
          ],
        } as any,
        afterCommit: [],
      },
      async () => {
        await expect(
          console.invite(
            {
              email: 'staff@example.test',
              role_id: '12345678-1234-1234-1234-123456789abc',
            },
            actor,
          ),
        ).rejects.toThrow('tenant-wide');
      },
    );
  });
});
