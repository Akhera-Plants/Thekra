/**
 * P3-3: Tiny helper that sets the HTTP 201 status and the Location response
 * header in one call, so admin "create" handlers don't repeat the same two
 * lines every time.
 *
 * @param res   Express Response (from `@Res({ passthrough: true })`).
 * @param path  Absolute API path for the newly-created resource, e.g.
 *              `/v1/admin/quotes/${quote.id}`.
 */

import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

export function setCreated(res: Response, path: string): void {
  res.status(HttpStatus.CREATED);
  res.header('Location', path);
}
