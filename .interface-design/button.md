# Thekra Button — kit contract

Source: `frontend/src/components/shared/kit/button/`  
Reference shape: nexa LMS `lmsui/components/button` (variant × tone × size, fill-on-hover outline).  
Tokens: Scholar's Desk in `frontend/src/app/globals.css` only — no hex.

## Live specimen (Claude check)

Open **`/dev/kit`** (ar) or **`/en/dev/kit`**.  
Matrix of every variant × tone, plus sizes / loading / selected / product roles.  
Not in the product nav. `robots: noindex`.

### Pass / fail for Claude

| Check | Pass when |
| --- | --- |
| Looks like a button | Outline has a visible coloured border + paper fill at rest; not bare underlined text |
| Hover | Outline paints **solid** in its tone (nexa rule); solid darkens slightly; ghost gains a wash |
| Press | `scale(0.97)` (unless `prefers-reduced-motion`) |
| Focus | Ring on `focus-visible` |
| Disabled / loading | `disabled` + opacity; loading shows spinner + `aria-busy` |
| Touch | `min-h-11` on mobile for every size |
| Tokens | Only semantic classes (`bg-primary`, `border-intent-sin`, …) |

## API

```ts
variant: 'solid' | 'outline' | 'ghost' | 'link'
tone:    'primary' | 'neutral' | 'destructive' | 'sin' | 'deed' | 'branch'
size:    'sm' | 'md' | 'lg'
icon?: ReactNode
iconPosition?: 'start' | 'end'
iconOnly?: boolean
loading?: boolean
asChild?: boolean
```

## Where to use which tone

| Surface | Variant × tone |
| --- | --- |
| Create account / primary submit | `solid` · `primary` |
| Sign in / quiet header action | `ghost` · `neutral` |
| Reader «تذكرة أخرى» | `outline` · `sin` (or `deed` / `branch` by path) |
| Reader «عرض المزيد» | `outline` · `neutral` |
| Deed of the day CTA | `outline` · `deed` |
| Theme toggle / icon chrome | `ghost` · `neutral` · `iconOnly` |
| Delete / fail | `outline` or `solid` · `destructive` |

Path doors on the home page are **links**, not Buttons — they stay as `PathLinks` arches.

## vs `components/ui/button`

shadcn `ui/button` stays for primitives that already compose it (Dialog close, Sidebar, InputGroup).  
**New product actions** on the public site and new kit work use `shared/kit/button`.  
Do not invent one-off `className` colours on either — pick a tone.
