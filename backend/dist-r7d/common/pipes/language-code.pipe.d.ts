import { PipeTransform } from '@nestjs/common';
export declare class LanguageCodePipe implements PipeTransform<string, string> {
    transform(value: string): string;
}
