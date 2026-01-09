# Quality Gate

🎮 **Phaser oyunları için kalite kontrol aracı**

Quality Gate, Phaser ile yazılmış HTML5 oyunları için otomatik güvenlik taraması, çalışma testi ve determinizm kontrolü yapan bir CLI aracıdır.

## Özellikler

### Check Modülleri
- **Safety Scan**: `eval()`, `innerHTML`, `debugger`, hardcoded secrets tespiti
- **Runtime Test**: Playwright ile headless browser testi
- **Determinism Check**: `Math.random()` analizi, seed mekanizması kontrolü

### Fixer Modülleri
- **Debug Remover**: `console.log`, `debugger` ifadelerini kaldırır
- **innerHTML Sanitizer**: `innerHTML` → `textContent` dönüşümü
- **Random Seeder**: Mulberry32 PRNG enjeksiyonu

## Kurulum

```bash
cd solution
npm install
npm run build
```

## Kullanım

### Temel Kullanım

```bash
# Oyunu tara
npx quality-gate <game-path>

# Otomatik düzeltme ile
npx quality-gate <game-path> --fix

# JSON çıktı
npx quality-gate <game-path> --json

# Verbose mod
npx quality-gate <game-path> --verbose
```

### Seçenekler

| Seçenek | Kısa | Açıklama |
|---------|------|----------|
| `--fix` | `-f` | Otomatik düzeltmeleri uygula |
| `--json` | `-j` | JSON formatında çıktı |
| `--skip <checks>` | `-s` | Belirli kontrolleri atla (comma-separated) |
| `--timeout <ms>` | `-t` | Runtime test timeout (varsayılan: 30000) |
| `--verbose` | `-v` | Detaylı çıktı |
| `--no-screenshot` | | Hata ekran görüntüsünü devre dışı bırak |
| `--help` | `-h` | Yardım göster |

### Örnekler

```bash
# Test oyunlarını tara
npx quality-gate ../test-games/clean-game
npx quality-gate ../test-games/debug-game --fix
npx quality-gate ../test-games/unsafe-game
npx quality-gate ../test-games/random-game --fix
npx quality-gate ../test-games/broken-game

# Belirli kontrolleri atla
npx quality-gate ../test-games/broken-game --skip runtime

# JSON çıktı ile
npx quality-gate ../test-games/clean-game --json > report.json
```

## Test Sonuçları

| Oyun | Beklenen | Açıklama |
|------|----------|----------|
| `clean-game` | ✅ PASS | Tüm testlerden geçer |
| `debug-game` | ❌ FAIL → ✅ PASS (--fix) | console.log var |
| `unsafe-game` | ❌ FAIL | eval(), innerHTML var |
| `random-game` | ❌ FAIL → ✅ PASS (--fix) | Seed yok |
| `broken-game` | ❌ FAIL | Runtime error var |

## Exit Codes

| Code | Anlam |
|------|-------|
| 0 | Tüm kontroller geçti |
| 1 | En az bir kontrol başarısız |
| 2 | Sistem hatası |

## Proje Yapısı

```
solution/
├── src/
│   ├── index.ts           # Entry point
│   ├── quality-gate.ts    # Orkestratör
│   ├── cli.ts             # CLI arayüzü
│   ├── reporter.ts        # Çıktı formatlama
│   ├── types.ts           # Tip tanımları
│   │
│   ├── checks/            # Kontrol modülleri
│   │   ├── safety-scan.ts
│   │   ├── runtime-test.ts
│   │   └── determinism.ts
│   │
│   └── fixers/            # Düzeltici modüller
│       ├── debug-remover.ts
│       ├── innerhtml-sanitizer.ts
│       └── random-seeder.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

## Teknolojiler

- **TypeScript** (strict mode)
- **Node.js 18+**
- **Playwright** (headless browser testing)
- **Commander.js** (CLI framework)
- **Chalk** (terminal colors)

## Lisans

MIT
