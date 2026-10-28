import { IsObject, Max, Min } from 'class-validator';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';

/**
 * PUT /me/practice. `store` is the practice-core store without `programs`
 * (PracticeStoreService validates it with parseStore); `version` is the
 * version the client last read (0 before the first save).
 */
export class PutPracticeStoreDto {
  @IsObject()
  store!: Record<string, unknown>;

  @IsStrictInt()
  @Min(0)
  @Max(2_000_000_000)
  version!: number;
}
