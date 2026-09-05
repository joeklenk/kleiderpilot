# KleiderPilot 1.1.5 – Importformat

## Einzelartikel

```json
{
  "app": "KleiderPilot",
  "type": "article-import",
  "version": 1,
  "item": {
    "audience": "Herren",
    "itemType": "T-Shirt",
    "brand": "Beispielmarke",
    "size": "M",
    "condition": "Sehr gut",
    "color": "Blau",
    "material": "Baumwolle",
    "model": "",
    "visualDetails": "",
    "personalNote": "",
    "listPrice": 20,
    "targetPrice": 18,
    "floorPrice": 15,
    "measurements": "",
    "flaws": "",
    "shipping": "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten",
    "images": []
  }
}
```

## Sammelimport

```json
{
  "app": "KleiderPilot",
  "type": "article-batch-import",
  "version": 1,
  "items": [
    { "itemType": "T-Shirt", "images": [] },
    { "itemType": "Pullover", "images": [] }
  ]
}
```

Bis zu 100 Artikel je Sammeldatei. Bilder werden als Data-URL übertragen, z. B. `data:image/jpeg;base64,...`. Unterstützt werden JPEG, PNG und WebP. Pro Artikel werden maximal 20 Bilder übernommen.

Die Artikelnummer (`A001`, `A002`, ...) gehört bewusst **nicht** in die Importdatei. KleiderPilot vergibt beim Import automatisch die nächste freie Nummer.
