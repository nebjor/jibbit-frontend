# JSON-LD-Format der Produktseiten — Recherche, Zielform, Entscheide

Stand: 2026-09-20. Umsetzung: `lib/seo/jsonld.ts` (Tests: `lib/seo/jsonld.test.ts`),
eingebaut in `app/products/[handle]/page.tsx` und `app/layout.tsx`.
Die Google-Search-Central-Seiten unten tragen «Last updated 2026-09-08 UTC» (Übersicht G-PROD:
2025-12-10). Die wörtlichen Zitate wurden im Rohtext der Seiten nachgeprüft, nicht aus einer
Zusammenfassung übernommen; MC-MULTI, MC-SIZE, G-ORG und die schema.org-Seiten nur zusammengefasst
gelesen.

## 1. Quellen

| Kürzel | Seite |
|---|---|
| G-ML | https://developers.google.com/search/docs/appearance/structured-data/merchant-listing |
| G-VAR | https://developers.google.com/search/docs/appearance/structured-data/product-variants |
| G-SNIP | https://developers.google.com/search/docs/appearance/structured-data/product-snippet |
| G-PROD | https://developers.google.com/search/docs/appearance/structured-data/product |
| G-RET | https://developers.google.com/search/docs/appearance/structured-data/return-policy |
| G-SHIP | https://developers.google.com/search/docs/appearance/structured-data/shipping-policy |
| G-ORG | https://developers.google.com/search/docs/appearance/structured-data/organization |
| MC-TOB | https://support.google.com/merchants/answer/12079603 (Dangerous products — free listings) |
| MC-MULTI | https://support.google.com/merchants/answer/6324488 (multipack) |
| MC-SIZE | https://support.google.com/merchants/answer/6324492 (size) |
| S-PG | https://schema.org/ProductGroup (+ hasVariant, variesBy, productGroupID, inProductGroupWithID, isVariantOf) |
| S-EQ | https://schema.org/eligibleQuantity |

## 2. Was die Recherche am Entwurf geändert hat

1. **GTIN gehört ans `Product`, nicht ans `Offer`.** G-ML führt `gtin | gtin8 | gtin12 | gtin13 | gtin14`
   ausschliesslich unter den `Product`-Eigenschaften («use the most specific GTIN»; nur Ziffern, keine
   URL-Form). Am `Offer` kennt Google das Feld nicht. Die bisherige Form (eine GTIN je `Offer` in einem
   `AggregateOffer`) wurde also sehr wahrscheinlich nie gelesen. Einzelstück und Display sind zwei
   Handelsartikel mit zwei GTINs → zwei `Product`-Knoten.
2. **`AggregateOffer` ist für Varianten ausdrücklich falsch.** G-SNIP: «Don't use AggregateOffer to describe
   a set of product variants.» G-ML: «Product snippets accept an Offer or AggregateOffer but merchant
   listings require an Offer». → ersatzlos gestrichen.
3. **`ProductGroup` + `hasVariant` ist die von Google empfohlene Form** für Seiten, auf denen alle Varianten
   auf EINER Seite wählbar sind (G-VAR, «single-page»: «We recommend this approach because it's the most
   compact and natural representation»). Pflicht: `name`; je Variante eine eindeutige Kennung (`sku` oder
   `gtin`); Gruppen-ID über `productGroupID` (muss an den Varianten dann NICHT als `inProductGroupWithID`
   wiederholt werden); **genau eine kanonische URL** für die Gruppe (ohne Vorauswahl); **jede Variante
   über eine eigene URL mit Query-Parameter vorauswählbar** — «Preselecting each variant includes showing
   the right image, price, and availability, as well as allowing the user to add the variant to the cart.»
   Das Markup selbst ändert sich beim Umschalten NICHT (G-VAR sagt das ausdrücklich).
4. **`variesBy` ist bei Google eine geschlossene Liste**: `color`, `size`, `suggestedAge`,
   `suggestedGender`, `material`, `pattern` (als volle schema.org-URL). Die Verpackungseinheit passt nur
   auf `size`. Merchant Center behandelt Nicht-Bekleidung genauso (MC-SIZE: «sizes for non-apparel products
   often aren't standardized … still submit each variant as a separate product, but use the same value for
   the item group ID»). Der Hinweis dort, die Multipack-Menge nicht in `size` zu schreiben, betrifft
   HÄNDLER-Multipacks; jibbits Displays sind HERSTELLER-Gebinde mit eigener GTIN — für die gilt laut
   MC-MULTI: kein `multipack`-Attribut, das Gebinde ist ein eigener Artikel.
5. **Staffelpreise: Google liest genau einen aktiven Preis.** G-ML kennt drei Preisarten — aktiv,
   durchgestrichen (`priceType: StrikethroughPrice`), Mitgliederpreis (`validForMemberTier`). «If you use
   both the offers.price and offers.priceSpecification properties to encode an active price, Google will
   use the price provided through the offers.price property and ignore the offers.priceSpecification
   property.» `eligibleQuantity` kommt in Googles Doku nicht vor; schema.org sieht es genau dafür vor
   (S-EQ: «ordering quantities for which the offer or price specification is valid», zulässig an
   `PriceSpecification`). → `Offer.price` = ehrlicher 1-Stück-Preis (das, was die Varianten-URL zeigt);
   Rabattstufen nur **ab der zweiten Stufe** (`minValue ≥ 2`) als `UnitPriceSpecification` +
   `eligibleQuantity`. Es gibt damit keinen zweiten «aktiven» Preis ohne Mengenbedingung, der dem ersten
   widersprechen könnte. `referenceQuantity` wurde entfernt: Google liest es als Grundpreisangabe
   (Einheiten aus der Merchant-Center-Liste, mit `valueReference`) und kennt «Stück»/H87 dort nicht;
   «pro Stück» sagt jetzt `unitCode: H87` an der Preisangabe.
6. **`ListPrice` → `StrikethroughPrice`.** G-ML: «You must set the priceType to the
   https://schema.org/StrikethroughPrice value (no other values are supported)»; `ListPrice` nur noch «for a
   transition period».
7. **Rückgabe: Markup WIRD gelesen — die frühere Auskunft («Markup erzeugt den Rückgabehinweis nicht») ist
   so nicht richtig.** G-RET: «Google Search can use this information to display return policies alongside
   your products and in knowledge panels»; G-ML, Abschnitt Returns: «make your merchant listing eligible to
   show return policy information». Richtig ist: (a) Markup ist die SCHWÄCHSTE Quelle — Rangfolge laut G-ML
   (stark → schwach): Produkt-Feed in Merchant Center → Content API → Einstellungen in Merchant
   Center/Search Console → Markup am Angebot → Markup an der Organisation; (b) Google garantiert keine
   Anzeige; (c) mit `MerchantReturnNotPermitted` gibt es ohnehin nichts Werbendes anzuzeigen. Empfohlen ist
   die Regel an der `Organization`; das Angebot darf per `@id` darauf verweisen («using only the @id
   keyword»). Stehen beide da, gilt das Angebot («Google defaults to the product-level return policy»).
   Pflicht: `applicableCountry` + `returnPolicyCategory` (oder nur `merchantReturnLink`).
8. **Versand gehört (auch) an die Organisation.** G-SHIP/G-ML empfehlen `Organization.hasShippingService`
   (`ShippingService` → `shippingConditions` mit `orderValue`, `shippingRate`, `transitTime`;
   `handlingTime` als `ServicePeriod`) und `Offer.shippingDetails` nur für Abweichungen. Dort lässt sich
   erstmals die Gratisversand-Schwelle ausdrücken (`orderValue.minValue`). Achtung: «If more than one
   ShippingConditions applies … we'll use the lowest shipping cost» → die Fenster dürfen nicht überlappen.
   Am Angebot liest Google nur noch `shippingRate` (`value` ODER `maxValue`, plus `currency`),
   `shippingDestination.addressCountry`, `deliveryTime.handlingTime/transitTime` (min + max, `DAY`).
9. **`hasAdultConsideration`:** «Google Search only supports the value
   https://schema.org/SexualContentConsideration». Der bestehende Wert
   `ReducedRelevanceForChildrenConsideration` ist gültiges schema.org, wird von Google aber übergangen.
   Bleibt stehen (wahr, für andere Leser), ist aber kein Google-Signal.
10. **Tabakzubehör — das grösste offene Thema, und kein Markup-Thema.** G-ML und G-SNIP (Content
    guidelines): «We don't allow content that promotes widely prohibited or regulated goods … This includes
    content related to firearms and weapons, recreational drugs, tobacco and vaping products, and
    gambling-related products.» MC-TOB (gilt für kostenlose Einträge) nennt als nicht unterstützt
    ausdrücklich: «Products that form a component part of a tobacco product, and products that directly
    facilitate or promote tobacco consumption — Examples: Rolling papers, pipes, tobacco filters, hookahs».
    Für Papers, Filter und Rolls ist also damit zu rechnen, dass Händlereinträge/Shopping-Kacheln NICHT
    erscheinen, egal wie gut das Markup ist. Das Markup bleibt trotzdem sinnvoll: organisches Verständnis
    der Seite, andere Suchmaschinen, Einkaufsassistenten, und alles im Sortiment, was nicht unter die Regel
    fällt.
11. **Organisation:** keine Pflichtfelder; empfohlen ist der spezifischste Subtyp (`OnlineStore` ✔);
    Platzierung auf der Startseite oder EINER Seite genügt (jede Seite ist erlaubt, nicht nötig). Der
    schema.org-Validator meldete `currenciesAccepted`/`paymentAccepted` als ungültig an
    `Organization`/`OnlineStore` (gehören zu `LocalBusiness`) → entfernt. `isPartOf` am Produkt
    (eine CreativeWork-Eigenschaft) ebenfalls entfernt.

## 3. Zielform A — mehrere Packungen: `ProductGroup`

```json
{
  "@type": "ProductGroup",
  "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#product",
  "name": "Angel Slim Filters 6mm 120stk",
  "description": "Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
  "url": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk",
  "image": [
    "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg",
    "https://jibbit.ch/media/jibbit.ch/angel-box.jpg"
  ],
  "brand": {
    "@type": "Brand",
    "name": "Angel"
  },
  "category": "Filter & Tips",
  "hasAdultConsideration": "https://schema.org/ReducedRelevanceForChildrenConsideration",
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "Ausführung",
    "value": "6mm Slim Filter"
  },
  "productGroupID": "angel-slim-filters-6mm-120stk",
  "variesBy": [
    "https://schema.org/size"
  ],
  "hasVariant": [
    {
      "@type": "Product",
      "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#variant-variant_01SINGLE",
      "name": "Angel Slim Filters 6mm 120stk – Einzeln",
      "description": "Einzeln: Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
      "sku": "variant_01SINGLE",
      "gtin13": "8595134501285",
      "image": [
        "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg"
      ],
      "size": "Einzeln",
      "offers": {
        "@type": "Offer",
        "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#offer-variant_01SINGLE",
        "url": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk?variant=variant_01SINGLE",
        "price": "1.40",
        "priceCurrency": "CHF",
        "priceValidUntil": "2027-09-20",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "seller": {
          "@id": "https://jibbit.ch/#organization"
        },
        "priceSpecification": [
          {
            "@type": "UnitPriceSpecification",
            "price": "1.30",
            "priceCurrency": "CHF",
            "valueAddedTaxIncluded": true,
            "unitCode": "H87",
            "eligibleQuantity": {
              "@type": "QuantitativeValue",
              "minValue": 10,
              "maxValue": 33,
              "unitCode": "H87"
            }
          },
          {
            "@type": "UnitPriceSpecification",
            "price": "1.20",
            "priceCurrency": "CHF",
            "valueAddedTaxIncluded": true,
            "unitCode": "H87",
            "eligibleQuantity": {
              "@type": "QuantitativeValue",
              "minValue": 34,
              "unitCode": "H87"
            }
          }
        ],
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "3.75",
            "currency": "CHF"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "CH"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 3,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 3,
              "unitCode": "DAY"
            },
            "businessDays": {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": [
                "https://schema.org/Monday",
                "https://schema.org/Tuesday",
                "https://schema.org/Wednesday",
                "https://schema.org/Thursday",
                "https://schema.org/Friday"
              ]
            }
          }
        },
        "hasMerchantReturnPolicy": {
          "@id": "https://jibbit.ch/#returnpolicy"
        }
      }
    },
    {
      "@type": "Product",
      "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#variant-variant_01DISPLAY",
      "name": "Angel Slim Filters 6mm 120stk – Display (34 Stk.)",
      "description": "Display (34 Stk.): Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
      "sku": "variant_01DISPLAY",
      "gtin12": "716165280293",
      "image": [
        "https://jibbit.ch/media/jibbit.ch/angel-box.jpg"
      ],
      "size": "Display (34 Stk.)",
      "offers": {
        "@type": "Offer",
        "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#offer-variant_01DISPLAY",
        "url": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk?variant=variant_01DISPLAY",
        "price": "40.80",
        "priceCurrency": "CHF",
        "priceValidUntil": "2027-09-20",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "seller": {
          "@id": "https://jibbit.ch/#organization"
        },
        "priceSpecification": [
          {
            "@type": "UnitPriceSpecification",
            "price": "38.00",
            "priceCurrency": "CHF",
            "valueAddedTaxIncluded": true,
            "unitCode": "H87",
            "eligibleQuantity": {
              "@type": "QuantitativeValue",
              "minValue": 2,
              "unitCode": "H87"
            }
          },
          {
            "@type": "UnitPriceSpecification",
            "priceType": "https://schema.org/StrikethroughPrice",
            "price": "47.60",
            "priceCurrency": "CHF"
          }
        ],
        "includesObject": {
          "@type": "TypeAndQuantityNode",
          "amountOfThisGood": 34,
          "unitCode": "H87",
          "typeOfGood": {
            "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#variant-variant_01SINGLE"
          }
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "maxValue": "9.00",
            "currency": "CHF"
          },
          "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "CH"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 3,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 1,
              "maxValue": 3,
              "unitCode": "DAY"
            },
            "businessDays": {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": [
                "https://schema.org/Monday",
                "https://schema.org/Tuesday",
                "https://schema.org/Wednesday",
                "https://schema.org/Thursday",
                "https://schema.org/Friday"
              ]
            }
          }
        },
        "hasMerchantReturnPolicy": {
          "@id": "https://jibbit.ch/#returnpolicy"
        }
      }
    }
  ]
}
```

## 4. Zielform B — eine Packung: `Product`

```json
{
  "@type": "Product",
  "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#product",
  "name": "Angel Slim Filters 6mm 120stk",
  "description": "Slim-Filter mit 6 mm Durchmesser, 120 Filter pro Packung.",
  "url": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk",
  "image": [
    "https://jibbit.ch/media/jibbit.ch/angel-slim.jpg",
    "https://jibbit.ch/media/jibbit.ch/angel-box.jpg"
  ],
  "brand": {
    "@type": "Brand",
    "name": "Angel"
  },
  "category": "Filter & Tips",
  "hasAdultConsideration": "https://schema.org/ReducedRelevanceForChildrenConsideration",
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "Ausführung",
    "value": "6mm Slim Filter"
  },
  "sku": "variant_01SINGLE",
  "gtin13": "8595134501285",
  "offers": {
    "@type": "Offer",
    "@id": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk#offer-variant_01SINGLE",
    "url": "https://jibbit.ch/products/angel-slim-filters-6mm-120stk",
    "price": "1.40",
    "priceCurrency": "CHF",
    "priceValidUntil": "2027-09-20",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {
      "@id": "https://jibbit.ch/#organization"
    },
    "priceSpecification": [
      {
        "@type": "UnitPriceSpecification",
        "price": "1.30",
        "priceCurrency": "CHF",
        "valueAddedTaxIncluded": true,
        "unitCode": "H87",
        "eligibleQuantity": {
          "@type": "QuantitativeValue",
          "minValue": 10,
          "maxValue": 33,
          "unitCode": "H87"
        }
      },
      {
        "@type": "UnitPriceSpecification",
        "price": "1.20",
        "priceCurrency": "CHF",
        "valueAddedTaxIncluded": true,
        "unitCode": "H87",
        "eligibleQuantity": {
          "@type": "QuantitativeValue",
          "minValue": 34,
          "unitCode": "H87"
        }
      }
    ],
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "3.75",
        "currency": "CHF"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "CH"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 1,
          "maxValue": 3,
          "unitCode": "DAY"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": 1,
          "maxValue": 3,
          "unitCode": "DAY"
        },
        "businessDays": {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": [
            "https://schema.org/Monday",
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday"
          ]
        }
      }
    },
    "hasMerchantReturnPolicy": {
      "@id": "https://jibbit.ch/#returnpolicy"
    }
  }
}
```

## 5. Organisation mit Rückgabe- und Versandregel (Layout, nur auf jibbits eigener Domain)

Anbieterangaben (Adresse, Telefon …) hier gekürzt.

```json
{
  "@type": [
    "Organization",
    "OnlineStore"
  ],
  "@id": "https://jibbit.ch/#organization",
  "name": "jibbit",
  "url": "https://jibbit.ch",
  "description": "Der erste gemeinschaftsorientierte Online Headshop der Schweiz.",
  "areaServed": {
    "@type": "Country",
    "name": "CH"
  },
  "hasMerchantReturnPolicy": {
    "@type": "MerchantReturnPolicy",
    "@id": "https://jibbit.ch/#returnpolicy",
    "name": "Rückgabe & Reklamation",
    "applicableCountry": "CH",
    "returnPolicyCountry": "CH",
    "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
    "merchantReturnLink": "https://jibbit.ch/service/rueckgabe"
  },
  "hasShippingService": {
    "@type": "ShippingService",
    "@id": "https://jibbit.ch/#shipping",
    "name": "Versand Schweiz",
    "description": "Brief CHF 3.75, Paket CHF 9.00, gratis ab CHF 69.00 Bestellwert. Versand nur in die Schweiz.",
    "fulfillmentType": "https://schema.org/FulfillmentTypeDelivery",
    "handlingTime": {
      "@type": "ServicePeriod",
      "duration": {
        "@type": "QuantitativeValue",
        "minValue": 1,
        "maxValue": 3,
        "unitCode": "DAY"
      },
      "businessDays": [
        "https://schema.org/Monday",
        "https://schema.org/Tuesday",
        "https://schema.org/Wednesday",
        "https://schema.org/Thursday",
        "https://schema.org/Friday"
      ]
    },
    "shippingConditions": [
      {
        "@type": "ShippingConditions",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "CH"
        },
        "orderValue": {
          "@type": "MonetaryAmount",
          "minValue": "0.00",
          "maxValue": "68.99",
          "currency": "CHF"
        },
        "shippingRate": {
          "@type": "MonetaryAmount",
          "maxValue": "9.00",
          "currency": "CHF"
        },
        "transitTime": {
          "@type": "ServicePeriod",
          "duration": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY"
          },
          "businessDays": [
            "https://schema.org/Monday",
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday"
          ]
        }
      },
      {
        "@type": "ShippingConditions",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "CH"
        },
        "orderValue": {
          "@type": "MonetaryAmount",
          "minValue": "69.00",
          "currency": "CHF"
        },
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0.00",
          "currency": "CHF"
        },
        "transitTime": {
          "@type": "ServicePeriod",
          "duration": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY"
          },
          "businessDays": [
            "https://schema.org/Monday",
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday"
          ]
        }
      }
    ]
  }
}
```

## 6. Pflicht / empfohlen — und was wir liefern

| Knoten | Eigenschaft | Status bei Google | Quelle | Bei uns |
|---|---|---|---|---|
| ProductGroup | `name` | Pflicht | G-VAR | ✔ Produkttitel |
| ProductGroup | `productGroupID` | Pflicht (oder `inProductGroupWithID` an den Varianten) | G-VAR | ✔ Handle |
| ProductGroup | `variesBy` | empfohlen, geschlossene Liste | G-VAR | ✔ `size` |
| ProductGroup | `hasVariant` | empfohlen | G-VAR | ✔ |
| ProductGroup | `url` | empfohlen, nur single-page, ohne Variantenparameter | G-VAR | ✔ kanonische URL |
| ProductGroup | `brand`, `description` | empfohlen (Marke nicht an Varianten wiederholen) | G-VAR | ✔ |
| ProductGroup | `aggregateRating`, `review` | empfohlen | G-VAR | ✘ keine Bewertungen vorhanden |
| Product | `name` | Pflicht; an Varianten GENAUER als die Gruppe | G-ML, G-VAR | ✔ «Titel – Packung» |
| Product | `image` | Pflicht | G-ML | ✔ eigenes Bild der Packung, sonst Produktbilder |
| Product | `offers` (`Offer`, nicht `AggregateOffer`) | Pflicht | G-ML | ✔ |
| Product | `sku` (ohne Leerzeichen) oder `gtin*` | Pflicht je Variante | G-VAR | ✔ `sku` = Artikelnummer aus Medusa, sonst Varianten-ID — derselbe Wert wie `id` im Merchant-Feed (seit 2026-09-29) |
| Product | `gtin8/12/13/14` | empfohlen, spezifischste Form | G-ML | ✔ wenn gepflegt und gültig |
| Product | `description` | «strongly recommended» | G-ML | ✔ «Packung: Beschreibung» |
| Product | `size` (max. 1 Wert) | empfohlen | G-ML | ✔ Packungseinheit |
| Product | `brand.name`, `category` | empfohlen | G-ML | ✔ an der Gruppe bzw. am Produkt |
| Product | `hasAdultConsideration` | nur `SexualContentConsideration` wird ausgewertet | G-ML | Wert bleibt, Google übergeht ihn |
| Product | `color`, `material`, `pattern`, `mpn`, `audience`, `hasCertification`, `subjectOf` | empfohlen | G-ML | ✘ keine Daten |
| Offer | `price` + `priceCurrency` | Pflicht, > 0 | G-ML | ✔ 1-Stück-Preis |
| Offer | `availability`, `itemCondition`, `priceValidUntil`, `url` | empfohlen (je genau ein Wert) | G-ML | ✔ |
| Offer | `shippingDetails` | empfohlen; Organisationsebene bevorzugt | G-ML, G-SHIP | ✔ beides |
| Offer | `hasMerchantReturnPolicy` | empfohlen; Organisationsebene bevorzugt, Verweis per `@id` | G-ML, G-RET | ✔ Verweis |
| UnitPriceSpecification | `price`, `priceCurrency` | Pflicht | G-ML | ✔ |
| UnitPriceSpecification | `priceType` | nur `StrikethroughPrice` | G-ML | ✔ bei «statt»-Preis |
| UnitPriceSpecification | `eligibleQuantity` | von Google nicht gelesen; schema.org-konform | S-EQ | ✔ Rabattstufen |
| OfferShippingDetails | `deliveryTime`, `shippingDestination.addressCountry`, `shippingRate` (`value` oder `maxValue`, `currency`) | Pflicht für die Versandanzeige | G-ML | ✔ |
| MerchantReturnPolicy | `applicableCountry`, `returnPolicyCategory` | Pflicht | G-RET | ✔ `CH`, `MerchantReturnNotPermitted` |
| MerchantReturnPolicy | `returnPolicyCountry`, `merchantReturnLink` | empfohlen | G-RET | ✔ |
| ShippingService | `shippingConditions` | Pflicht | G-SHIP | ✔ zwei Fenster (< 69 / ≥ 69) |
| ShippingService | `name`, `description`, `fulfillmentType`, `handlingTime` | empfohlen | G-SHIP | ✔ (ohne `cutoffTime` — es gibt keine solche Zusage) |
| Organization | — | keine Pflichtfelder; `logo` ≥ 112 px empfohlen | G-ORG | ✘ Logo fehlt weiterhin |

## 7. Entscheide

- **Varianten-URL = `?variant=<Medusa-Varianten-ID>`** (`VARIANT_PARAM` in `lib/pricing.ts`). ID statt
  sprechendem Slug: Titel werden im Admin umbenannt, IDs nicht. (`sku` trägt seit 2026-09-29 die
  Artikelnummer, damit sie der `id` im Merchant-Feed entspricht; die URL bleibt bei der ID.)
  Die Seite liest den Parameter serverseitig (`preselectedVariant`) und wählt Kaufbox UND LCP-Bild vor;
  unbekannte IDs fallen auf die übliche Vorauswahl. Eine ausverkaufte Packung wird trotzdem angezeigt
  (mit «Ausverkauft») — die URL soll zeigen, was sie verspricht. Bei jeder Auswahl schreibt der Provider
  die URL per `history.replaceState` nach (kein Reload, kein Verlaufseintrag). Sonst ist das Verhalten
  der Seite unverändert.
- **Canonical** ist immer `/products/<handle>` ohne Parameter (neu in `generateMetadata`; vorher gab es
  gar keinen Canonical). Varianten-URLs gehören NICHT in die Sitemap.
- **`productGroupID` = Handle.** Ein späterer Merchant-Center-Feed MUSS denselben Wert als
  `item_group_id` führen und dieselben `sku`/GTIN je Packung («If you provide the identifier for both …
  they must match»).
- **`@id`s:** Gruppe/Produkt `…#product`, Packung `…#variant-<id>`, Angebot `…#offer-<id>`.
  `includesObject.typeOfGood` des Displays verweist auf das Einzelstück desselben Produkts (vorher: auf
  sich selbst).
- **Versand am Angebot, je Packung:** ein Versandpreis fest (`value`, `SHIPPING.rate`); Packung ≥ CHF 69 → 0.
- **Welche Ebene gewinnt:** Angebot schlägt Organisation; Merchant Center/Search Console schlagen beide.
  Rückgabe: eine Regel an der Organisation, die Angebote verweisen. Versand: allgemeine Regel an der
  Organisation (mit Schwelle), genauerer Satz am Angebot.
- **Bild je Packung:** eigenes Bild → nur dieses; sonst die Produktbilder ohne die Bilder anderer
  Packungen.

## 8. Prüfung

- `validator.schema.org` (POST `/validate`; beide Beispiele samt Organisation, WebSite, Brotkrümel; die
  Anbieterangaben wurden vor dem Absenden entfernt): **0 Fehler, 0 Warnungen**. Erster Lauf: 2 Warnungen zu
  `currenciesAccepted`/`paymentAccepted` → behoben.
- Googles Rich Results Test nimmt Code nur über die Web-Oberfläche an (kein abrufbarer Endpunkt); geprüft
  wurde deshalb von Hand gegen die Pflichtlisten aus Abschnitt 6. **Nach dem Deploy nachholen:**
  https://search.google.com/test/rich-results mit einer Produkt-URL UND einer `?variant=`-URL.

## 9. Offen

1. **Richtlinie Tabakzubehör** (Abschnitt 2, Punkt 10): klären, ob/welche Artikel in Merchant Center
   überhaupt zugelassen werden; die Erwartung an Shopping-Kacheln für Papers/Filter entsprechend tief
   halten.
2. **GTINs pflegen** — je Packung. Ohne GTIN bleibt `sku` die einzige Kennung (zulässig, aber kein
   Abgleich mit Mitbewerbern).
3. **Gewicht in die View** (`ProductVariantView.weight`): dann kann der Versandsatz am Angebot exakt
   Brief oder Paket sagen statt `maxValue`.
4. **Logo** (≥ 112 × 112 px) fehlt weiterhin an der Organisation.
5. **Search Console:** nach dem Deploy «Händlereinträge» und «Produkt-Snippets» beobachten und die
   Validierung anstossen. Unter «Shopping» lassen sich dort Versand- und Rückgabeeinstellungen setzen —
   sie übersteuern das Markup und müssen deshalb dasselbe sagen.
6. **Grundpreis am Display** («CHF 1.20 / Stk.») liesse sich über `priceSpecification.referenceQuantity`
   mit Einheit `ct` ausdrücken — Google verlangt dafür aber den aktiven Preis IN der `priceSpecification`
   statt an `Offer.price`. Bewusst nicht gemacht: `Offer.price` ist für alle anderen Leser die robustere
   Stelle, und eine Grundpreispflicht besteht für Stückware nicht.
7. **Fremde Mandanten:** Angebote verweisen auch dort auf `#returnpolicy`, das nur auf jibbits Domain
   definiert ist (bestehendes Verhalten, nicht Teil dieses Umbaus).
