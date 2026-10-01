import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Controller, Get, Injectable, Module, Req, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { bootstrap, type TestApp } from './helpers.js';

const SECRET = 'test-secret';

@Injectable()
class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET });
  }

  validate(payload: { sub: string; name: string }) {
    return { id: payload.sub, name: payload.name };
  }
}

@Controller('auth')
class AuthController {
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: { user: unknown }) {
    return req.user;
  }
}
@Module({
  imports: [PassportModule, JwtModule.register({ secret: SECRET })],
  controllers: [AuthController],
  providers: [JwtStrategy],
})
class AuthModule {}

describe('@nestjs/passport + passport-jwt', () => {
  let t: TestApp;
  let token: string;
  beforeAll(async () => {
    t = await bootstrap(AuthModule);
    token = await t.app.get(JwtService).signAsync({ sub: '42', name: 'Ada' });
  });
  afterAll(() => t.close());

  it('rejects requests without a valid bearer token', async () => {
    expect((await t.json('/auth/me')).status).toBe(401);
    const forged = await t.json('/auth/me', { headers: { authorization: `Bearer ${token}x` } });
    expect(forged.status).toBe(401);
  });

  it('runs the strategy and exposes the validated user on req.user', async () => {
    const res = await t.json('/auth/me', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '42', name: 'Ada' });
  });
});
