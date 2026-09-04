import { cursorScope, decodeCursor, paginateRows, type CursorRequest } from './cursor';
const rows = Array.from({ length: 26 }, (_, n) => ({ id: String(n + 1).padStart(3, '0'), createdAt: n < 13 ? '2026-01-01' : '2026-01-02', name: `Row ${n + 1}`, category: n % 2 ? 'A' : 'B', price: n }));
function request(cursor?: string | null, options: Partial<CursorRequest> = {}): CursorRequest {
  const scope = options.scope ?? cursorScope(['tenant-one','branch-one','inventory']);
  return { path: '/inventory', scope, cursor: decodeCursor(cursor ?? undefined, scope), order: 'desc', search: '', filters: [], ...options };
}
describe('reusable cursor windows', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'pagination-unit-test-secret' });
  it('returns 10/10/6 rows, no duplicates with tied sort values, and reverses exactly', () => {
    const first = paginateRows(rows, request());
    const second = paginateRows(rows, request(first.pageInfo.nextCursor));
    const last = paginateRows(rows, request(second.pageInfo.nextCursor));
    expect([first.data.length,second.data.length,last.data.length]).toEqual([10,10,6]);
    expect(new Set([...first.data,...second.data,...last.data].map(row => row.id)).size).toBe(26);
    expect(last.pageInfo.hasNextPage).toBe(false);
    expect(last.pageInfo.to).toBe(26);
    expect(paginateRows(rows,request(last.pageInfo.previousCursor)).data).toEqual(second.data);
    expect(paginateRows(rows,request(second.pageInfo.previousCursor)).data).toEqual(first.data);
    expect(first.pageInfo.previousCursor).toBeNull();
  });
  it('supports ascending order and filters before the boundary', () => {
    const options = { sort: 'price', order: 'asc' as const, filters: [{ field:'category', op:'eq' as const, value:'A' }] };
    const page = paginateRows(rows,request(null,options));
    expect(page.total).toBe(13);
    expect(page.data.map(row => row.price)).toEqual([1,3,5,7,9,11,13,15,17,19]);
    expect(paginateRows(rows,request(page.pageInfo.nextCursor, options)).data.map(row => row.price)).toEqual([21,23,25]);
  });
  it('continues after the anchor is deleted and new earlier rows are inserted', () => {
    const first = paginateRows(rows,request());
    const removed = rows.filter(row => row.id !== first.data[9].id);
    const original = paginateRows(rows,request(first.pageInfo.nextCursor));
    const changed = paginateRows([{...rows[0],id:'999',createdAt:'2026-05-01'},...removed],request(first.pageInfo.nextCursor));
    expect(changed.data).toEqual(original.data);
  });
  it('rejects forged, expired and cross-tenant/branch/filter/table tokens', () => {
    const token = paginateRows(rows,request()).pageInfo.nextCursor!;
    expect(() => decodeCursor(token+'x',request().scope)).toThrow();
    for (const scope of ['other-tenant','other-branch','other-filter','other-table']) expect(() => decodeCursor(token,cursorScope(scope))).toThrow();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now()+3600001);
    expect(() => decodeCursor(token,request().scope)).toThrow();
    clock.mockRestore();
  });
  it('keeps null values last and navigates backwards across them', () => {
    const nullable = rows.map((row,i) => ({...row,createdAt:i > 15 ? null : row.createdAt}));
    const first = paginateRows(nullable,request());
    const second = paginateRows(nullable,request(first.pageInfo.nextCursor));
    const third = paginateRows(nullable,request(second.pageInfo.nextCursor));
    expect(third.data.every(row => row.createdAt === null)).toBe(true);
    expect(paginateRows(nullable,request(third.pageInfo.previousCursor)).data).toEqual(second.data);
  });
  it('handles empty collections and searches globally', () => {
    expect(paginateRows([], request()).pageInfo).toMatchObject({from:0,to:0,total:0,hasNextPage:false,hasPreviousPage:false});
    expect(paginateRows(rows,request(null,{search:'row 26'})).data[0].name).toBe('Row 26');
  });
});
