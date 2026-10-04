import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function makeHost(statusSpy: ReturnType<typeof vi.fn>, jsonSpy: ReturnType<typeof vi.fn>) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusSpy.mockReturnValue({ json: jsonSpy }) }),
      getRequest: () => ({
        url: '/v1/admin/sin-quotes',
        method: 'POST',
        headers: {},
      }),
    }),
  };
}

describe('AllExceptionsFilter Prisma→HTTP mapping', () => {
  const filter = new AllExceptionsFilter();

  it('maps P2002 to 409 RESOURCE_ALREADY_EXISTS', () => {
    const status = vi.fn();
    const json = vi.fn();
    const error = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '6',
      meta: { target: ['slug'] },
    });
    filter.catch(error, makeHost(status, json) as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].error.code).toBe('RESOURCE_ALREADY_EXISTS');
  });

  it('maps P2003 to 422 RELATED_RESOURCE_INVALID', () => {
    const status = vi.fn();
    const json = vi.fn();
    const error = new Prisma.PrismaClientKnownRequestError('FK', {
      code: 'P2003',
      clientVersion: '6',
    });
    filter.catch(error, makeHost(status, json) as never);
    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0][0].error.code).toBe('RELATED_RESOURCE_INVALID');
  });

  it('maps P2025 to 404 RESOURCE_NOT_FOUND', () => {
    const status = vi.fn();
    const json = vi.fn();
    const error = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '6',
    });
    filter.catch(error, makeHost(status, json) as never);
    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0].error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('maps unknown Prisma codes to 500 INTERNAL_ERROR without leaking the message', () => {
    const status = vi.fn();
    const json = vi.fn();
    const error = new Prisma.PrismaClientKnownRequestError('secret db detail', {
      code: 'P2010',
      clientVersion: '6',
    });
    filter.catch(error, makeHost(status, json) as never);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
    expect(json.mock.calls[0][0].error.message).toBe('An unexpected error occurred');
  });

  it('preserves HttpException status and allows an explicit code', () => {
    const status = vi.fn();
    const json = vi.fn();
    filter.catch(
      new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin not found' }),
      makeHost(status, json) as never,
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0].error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('maps ConflictException to RESOURCE_ALREADY_EXISTS by default', () => {
    const status = vi.fn();
    const json = vi.fn();
    filter.catch(new ConflictException('dup'), makeHost(status, json) as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].error.code).toBe('RESOURCE_ALREADY_EXISTS');
  });
});
