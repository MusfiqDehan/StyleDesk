declare module 'node-zklib' {
  export interface ZKUser {
    uid: number;      // internal serial (auto-increment, never reused — used for CMD_DELETE_USER)
    role: number;
    password: string;
    name: string;
    cardno: number;
    userId: string;   // enrollment number shown on device (user-visible, can be reused)
  }

  export interface ZKAttendance {
    deviceUserId?: string | number | null;
    attTime?: Date | string | number | null;
    recordTime?: Date | string | number | null;
    verifyMethod: number;
    inOutStatus: number;
    uid?: number | string | null;
    userId?: number | string | null;
    userSn?: number | string | null;
  }

  export interface ZKUserResult {
    data: ZKUser[];
  }

  export interface ZKAttendanceResult {
    data: ZKAttendance[];
  }

  class ZKLib {
    constructor(ip: string, port: number, timeout: number, inport: number);
    createSocket(): Promise<void>;
    disconnect(): Promise<void>;
    getUsers(): Promise<ZKUserResult>;
    getAttendances(): Promise<ZKAttendanceResult>;
    clearAttendanceLog(): Promise<void>;
    getInfo(): Promise<Record<string, unknown>>;
    executeCmd(command: number, data: Buffer | string): Promise<Buffer>;
    getRealTimeLogs(
      cb: (data: { userId?: string | number | null; attTime?: Date | string | number | null }) => void,
    ): Promise<void>;
  }

  export default ZKLib;
}
