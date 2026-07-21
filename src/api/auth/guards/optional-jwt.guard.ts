import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Reads the Bearer token when present, but never blocks the request when
// it's missing or invalid — used for endpoints that support guest access
// (e.g. placing an order without logging in) while still identifying the
// user when a valid token is provided.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || undefined;
  }
}
