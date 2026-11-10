import { HttpStatus } from '@nestjs/common';
export function setCreated(res, path) {
    res.status(HttpStatus.CREATED);
    res.header('Location', path);
}
//# sourceMappingURL=set-created.js.map