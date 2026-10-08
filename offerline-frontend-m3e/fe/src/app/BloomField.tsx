/**
 * The soft, blurred field behind every glass surface. Without it, glass has
 * nothing to refract and reads as a flat translucent rectangle rather than
 * a pane over something. Forest is the large form, vermilion the smaller
 * and quieter one, warm neutral the third that keeps the field from
 * reading as two coloured blobs (all three notes taken directly from
 * docs/brand/tokens.json).
 */
export function BloomField() {
  return (
    <div className="bloom-field" aria-hidden="true">
      <div className="bloom-field__shape bloom-field__shape--forest" />
      <div className="bloom-field__shape bloom-field__shape--verm" />
      <div className="bloom-field__shape bloom-field__shape--warm" />
    </div>
  )
}
