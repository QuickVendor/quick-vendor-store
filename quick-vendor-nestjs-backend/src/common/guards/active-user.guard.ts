import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { status: string } }>();
    const user = request.user;

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is suspended or deactivated');
    }

    return true;
  }
}
