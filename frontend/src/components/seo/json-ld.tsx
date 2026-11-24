export function JsonLd({ value }: { value: Record<string, unknown> }) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return <script type="application/ld+json">{json}</script>;
}
