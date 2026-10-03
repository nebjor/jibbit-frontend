import styles from "./PaymentIcons.module.css";
import {
  ApplePayLogo,
  GooglePayLogo,
  MastercardLogo,
  PostFinanceLogo,
  TwintLogo,
  VisaLogo,
} from "./PaymentLogos";

/**
 * Was zahls.ch für jibbit abwickelt: TWINT, Visa, Mastercard, PostFinance,
 * Apple Pay und Google Pay — als echte Markenlogos (Quellen und Lizenzen in
 * PaymentLogos.tsx) auf gleich grossen, weissen Kacheln. Die Kachel bleibt
 * bewusst weiss (kein Token), damit die Markenfarben stimmen.
 *
 * Jedes Logo trägt role="img" + aria-label; die Liste selbst ist mit
 * «Zahlungsarten» beschriftet, damit Screenreader den Block einordnen.
 */

const LOGOS = [
  { key: "twint", Logo: TwintLogo },
  { key: "visa", Logo: VisaLogo },
  { key: "mastercard", Logo: MastercardLogo },
  { key: "postfinance", Logo: PostFinanceLogo },
  { key: "applepay", Logo: ApplePayLogo },
  { key: "googlepay", Logo: GooglePayLogo },
] as const;

export function PaymentIcons() {
  return (
    <ul className={styles.list} aria-label="Zahlungsarten">
      {LOGOS.map(({ key, Logo }) => (
        <li key={key} className={styles.badge}>
          {/* Nicht jede Marke hat eine eigene Klasse — `undefined` rausfiltern. */}
          <Logo className={[styles.svg, styles[key]].filter(Boolean).join(" ")} />
        </li>
      ))}
    </ul>
  );
}
