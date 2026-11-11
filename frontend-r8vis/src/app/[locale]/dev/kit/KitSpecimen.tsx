'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/shared/kit/button';
import type { ButtonSize, ButtonTone, ButtonVariant } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { useState } from 'react';

const VARIANTS: ButtonVariant[] = ['solid', 'outline', 'ghost', 'link'];
const TONES: ButtonTone[] = ['primary', 'neutral', 'destructive', 'sin', 'deed', 'branch'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

export function KitSpecimen() {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(false);

  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Button — variant × tone</h2>
        <p className="text-sm text-muted-foreground">
          Outline must look clickable at rest (border + paper fill) and fill solid on hover — nexa
          rule. Ghost stays quiet until hover. Link underlines.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">tone \\ variant</th>
                {VARIANTS.map((variant) => (
                  <th key={variant} className="px-2 py-2 font-medium">
                    {variant}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TONES.map((tone) => (
                <tr key={tone} className="border-b border-border/70">
                  <th className="px-2 py-3 text-start font-medium text-muted-foreground">{tone}</th>
                  {VARIANTS.map((variant) => (
                    <td key={variant} className="px-2 py-3">
                      <Button type="button" variant={variant} tone={tone} size="md">
                        Action
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Sizes · icon · loading · selected · disabled</h2>
        <div className="flex flex-wrap items-center gap-3">
          {SIZES.map((size) => (
            <Button key={size} type="button" variant="solid" tone="primary" size={size}>
              {size}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            tone="neutral"
            size="md"
            icon={<ChevronDown aria-hidden />}
            iconPosition="end"
          >
            Show more
          </Button>
          <Button type="button" variant="solid" tone="primary" size="md" iconOnly icon={<Plus aria-hidden />} aria-label="Add" />
          <Button type="button" variant="solid" tone="primary" size="md" loading>
            Saving
          </Button>
          <Button
            type="button"
            variant="outline"
            tone="primary"
            size="md"
            data-selected={selected || undefined}
            onClick={() => setSelected((value) => !value)}
          >
            {selected ? 'Selected' : 'Select me'}
          </Button>
          <Button type="button" variant="solid" tone="primary" size="md" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Product roles (where to use what)</h2>
        <ul className="grid gap-3 text-sm md:grid-cols-2">
          <li className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Button type="button" variant="solid" tone="primary" size="md">
              إنشاء حساب
            </Button>
            <span className="text-muted-foreground">solid · primary — main CTA</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Button type="button" variant="ghost" tone="neutral" size="md">
              تسجيل الدخول
            </Button>
            <span className="text-muted-foreground">ghost · neutral — secondary nav</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Button type="button" variant="outline" tone="deed" size="md">
              نصوص هذه الطاعة
            </Button>
            <span className="text-muted-foreground">outline · deed — deed of the day</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Button type="button" variant="outline" tone="branch" size="md">
              شعبة اليوم
            </Button>
            <span className="text-muted-foreground">outline · branch — branch path</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Button type="button" variant="outline" tone="destructive" size="md">
              حذف
            </Button>
            <span className="text-muted-foreground">outline · destructive — delete</span>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">SegmentTabs</h2>
        <SegmentTabs
          aria-label="Specimen tabs"
          variant="segment"
          size="filled"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'all', label: 'الكل', count: 34 },
            { value: 'verse', label: 'الآيات', count: 22 },
            { value: 'hadith', label: 'الأحاديث', count: 12 },
          ]}
        />
      </section>
    </div>
  );
}
