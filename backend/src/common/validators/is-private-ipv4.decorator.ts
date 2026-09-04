import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isPrivateOrLoopbackIp } from '../is-private-ip.js';

@ValidatorConstraint({ name: 'isPrivateIpv4', async: false })
export class IsPrivateIpv4Constraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isPrivateOrLoopbackIp(value);
  }

  defaultMessage(): string {
    return 'IP must be a private/LAN IPv4 address (10/8, 172.16/12, 192.168/16, or loopback)';
  }
}

export function IsPrivateIpv4(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPrivateIpv4Constraint,
    });
  };
}
