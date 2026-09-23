import styles from "./PaymentIcons.module.css";

/**
 * Was zahls.ch für jibbit abwickelt: TWINT, Visa, Mastercard, PostFinance.
 * Vereinfachte Zeichen — die offiziellen Akzeptanzzeichen gibt es nur über
 * die Markenportale der Anbieter.
 */

function Badge({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className={styles.badge} title={label}>
      <svg
        viewBox="0 0 60 24"
        role="img"
        aria-label={label}
        className={styles.svg}
      >
        {children}
      </svg>
    </li>
  );
}

const text = {
  fill: "currentColor",
  fontWeight: 700,
  textAnchor: "middle" as const,
};

export function PaymentIcons() {
  return (
    <ul className={styles.list} aria-label="Zahlungsarten">
      <Badge label="TWINT">
        <rect x="3" y="5" width="14" height="14" rx="3" fill="currentColor" />
        <path
          d="M7 12.5l2.2 2.2L13.5 9.5"
          fill="none"
          style={{ stroke: "var(--c-surface)" }}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="38" y="16.5" fontSize="11" {...text}>
          TWINT
        </text>
      </Badge>
      <Badge label="Visa">
        <text
          x="30"
          y="17"
          fontSize="14"
          fontStyle="italic"
          letterSpacing="0.5"
          {...text}
        >
          VISA
        </text>
      </Badge>
      <Badge label="Mastercard">
        <circle cx="25" cy="12" r="7" fill="currentColor" opacity="0.85" />
        <circle
          cx="35"
          cy="12"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </Badge>
      <Badge label="PostFinance">
        <text x="30" y="15.5" fontSize="8.5" {...text}>
          PostFinance
        </text>
      </Badge>
    </ul>
  );
}
