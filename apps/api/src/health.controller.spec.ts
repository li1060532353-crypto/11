import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the stable health envelope', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ data: { status: 'ok' } });
  });
});
