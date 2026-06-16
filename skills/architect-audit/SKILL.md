---
name: architect-audit
description: Audit legacy codebase for bounded contexts and architectural debt. Three phases: inventory (what bounded contexts exist), diagnosis (where business logic leaks through layers), roadmap (refactor priorities by risk and value). Optimized for PHP/Symfony but applicable to any layered backend.
---

# Cel skilla

Skill prowadzi agenta przez 3-fazowy audyt architektoniczny legacy codebase. Fazy są sekwencyjne — każda buduje na poprzedniej. Wynikiem jest zestaw dokumentów: mapa kontekstów, lista "rozjazdów" między modelem a kodem, oraz roadmapa refaktorów z priorytetami P0/P1/P2. Skill jest zaprojektowany dla systemu który działa na produkcji — nie greenfield.

# Kiedy używać

- **Tech debt assessment** — przed planowaniem kwartału lub roku, gdy zespół chce zobiektywizować rozmowę o długu technologicznym.
- **Onboarding architekta / tech leada** — szybkie zrozumienie "jak naprawdę wygląda" system, nie jak powinien wyglądać.
- **Argumentacja dla biznesu** — twardy raport z konkretnymi ryzykami i szacunkami kosztu refaktorów vs kosztu nie-refaktorowania.

---

# Faza 1: Inwentaryzacja (Inventory)

**Cel**: Zrozumieć co faktycznie JEST w kodzie — bez interpretacji, tylko obserwacja.

## Krok 1.1 — Mapa repozytorium

Przejdź przez strukturę katalogów na poziomie top-level i jeden poziom głębiej. Zapisz co widzisz:

```
src/
├── Controller/      → warstwa HTTP (ile plików?)
├── Entity/          → model danych (ile encji?)
├── Repository/      → dostęp do danych (ile?)
├── Service/         → logika aplikacyjna (ile?)
├── EventSubscriber/ → zdarzenia (ile?)
└── ...
```

Szukaj też niestandardowych katalogów (`Domain/`, `Application/`, `Infrastructure/`, `Legacy/`) — ich obecność lub brak mówi dużo o historii projektu.

## Krok 1.2 — Identyfikacja modułów / bundlów

Sprawdź:
- Czy są custom Symfony bundles? (`src/*Bundle/`)
- Czy są katalogi mapowane na osobne podsystemy? (`src/Billing/`, `src/Catalog/`)
- Czy jest `composer.json` z lokalnymi packages (monorepo pattern)?

Jeśli modułów brak — cały kod jest prawdopodobnie w jednej przestrzeni nazw. Odnotuj to.

## Krok 1.3 — Mapa wiedzy domenowej (Contributors)

Uruchom `git log --format="%ae %f" -- src/` i zidentyfikuj:
- Kto pisał jakie części kodu
- Gdzie są "sieroty" (pliki bez aktywnych commitujących od >6 miesięcy)
- Gdzie skupia się wiedza o konkretnych procesach biznesowych

## Krok 1.4 — Kandydaci na Bounded Contexty

Przeglądaj nazwy encji, serwisów, controllerów i identyfikuj klastry rzeczowników biznesowych:

Szukaj wzorców:
- Rzeczowniki powtarzające się razem (`Order`, `OrderItem`, `OrderStatus`, `OrderFulfillment` → kandydat: **Ordering**)
- Workflowy opisane w nazwach metod (`submitOrder`, `confirmPayment`, `shipOrder`)
- Encje z dużą liczbą relacji — często centrum kontekstu

**Deliverable Fazy 1** — dokument `audit-phase1-inventory.md` z sekcjami:

```markdown
## Repo Map
[top-level structure z liczbą plików per katalog]

## Moduły / Bundles
[lista + czy jest separacja czy monolit]

## Kandydaci na Bounded Contexty
| Kandydat       | Kluczowe klasy               | Właściciel (git) |
|----------------|------------------------------|------------------|
| Ordering       | Order, OrderItem, ...        | @developer-a     |
| Catalog        | Product, Category, ...       | @developer-b     |
| ...            | ...                          | ...              |
```

---

# Faza 2: Diagnoza (Diagnosis)

**Cel**: Zidentyfikować konkretne miejsca gdzie architektura "sika" — gdzie kod robi coś innego niż powinien na danej warstwie.

## Krok 2.1 — Logika biznesowa w warstwie prezentacji

Sprawdź controllery i templates (Twig) pod kątem:
- Warunki biznesowe w controllerze (`if ($order->getTotal() > 1000 && $customer->isVip())`)
- Obliczenia wprost w Twig (`{{ order.total * 0.23 }}` zamiast `order.vatAmount`)
- `$em->persist()` / `$em->flush()` w controllerze bez pośrednictwa serwisu
- Tworzenie encji przez `new Order(...)` w controllerach

## Krok 2.2 — Niezmienniki domenowe niechronione

Znajdź encje które powinny mieć niezmienniki (invariants) ale nie mają:
- Settery publiczne na wszystkich polach bez walidacji (`setStatus(string $s)`)
- Encje z logiką "zawsze musi mieć co najmniej jeden item" — czy to jest enforced w konstruktorze?
- Brak ValueObjects dla typów z ograniczeniami (email, kwota pieniężna, kod pocztowy)
- Encje modyfikowane bezpośrednio przez `$em->getReference()` bez przejścia przez metodę domenową

## Krok 2.3 — Brak Anti-Corruption Layer dla integracji

Sprawdź integracje z zewnętrznymi serwisami (bramki płatności, kurierzy, ERP):
- Czy modele zewnętrznych API (np. klasy response ze Stripe SDK) przenikają do warstwy domenowej?
- Czy serwisy domenowe zależą bezpośrednio od klientów HTTP / SDK (zamiast przez interfejs)?
- Szukaj `use Stripe\` lub podobnych importów w katalogach `Domain/` lub `Service/`

## Krok 2.4 — Wycieki przez serializację

Sprawdź co jest serializowane w odpowiedziach API:
- Encje zwracane bezpośrednio z controllerów (bez DTO / transformacji)
- Brak `#[Groups]` na polach encji przy użyciu JMS lub Symfony Serializer
- Relacje Doctrine serializowane rekurencyjnie (circular reference risk)

**Deliverable Fazy 2** — dokument `audit-phase2-diagnosis.md` z listą rozjazdów:

```markdown
## Rozjazdy MODEL vs KOD

| # | Gdzie                          | Co                                      | Severity  |
|---|--------------------------------|-----------------------------------------|-----------|
| 1 | OrderController:142            | Logika rabatowa (15 linii if/else)      | High      |
| 2 | Order::setStatus()             | Brak walidacji dozwolonych przejść      | High      |
| 3 | PaymentService → StripeClient  | Brak ACL, Stripe response w domenie     | Medium    |
| 4 | ProductController::list        | Encje bez Groups, wszystkie pola w JSON | Medium    |
| 5 | InvoiceService::generate()     | $em->flush() wewnątrz pętli             | Low       |
```

Minimum 5, maksimum 10 pozycji. Jeśli jest ich więcej — grupuj po typie problemu.

---

# Faza 3: Roadmapa (Roadmap)

**Cel**: Zamienić listę problemów na priorytety. Nie wszystko da się zrobić naraz — roadmapa mówi co PIERWSZE i dlaczego.

## Kryteria priorytetyzacji

Każdy refaktor oceniaj w trzech wymiarach:

**Risk** — co się stanie jeśli tego NIE naprawimy:
- P0: aktywne ryzyko bezpieczeństwa lub brak możliwości dalszego rozwoju
- P1: rosnący dług który w ciągu 2-3 kwartałów zatrzyma feature development
- P2: "tech hygiene" — warto, ale nie boli teraz

**Value** — co zyskujemy po naprawie:
- Szybkość onboardingu nowych developerów
- Możliwość niezależnego deploymentu modułów
- Redukcja czasu debugowania incydentów

**Cost** — ile to kosztuje:
- Szacuj w "osobotygodniach" nie story pointach
- Uwzględnij ryzyko migracji danych, zmiany API, konieczność testów

## Krok 3.1 — Scoring

Dla każdego rozjazdu z Fazy 2:

```
Score = Risk (1-3) × Value (1-3) / Cost (1-3)
```

Najwyższy score → najwyższy priorytet.

## Krok 3.2 — Quick Wins vs Big Bets

Zidentyfikuj oddzielnie:
- **Quick wins**: Cost=1, Risk≥2 lub Value≥2 → można zrobić w jednym sprincie
- **Big bets**: fundamentalne przepisania (wyodrębnienie bounded contextu), planowane na 1+ kwartał

**Deliverable Fazy 3** — dokument `audit-phase3-roadmap.md`:

```markdown
## Roadmapa Refaktorów

### P0 — Krytyczne (następny sprint)
| Refaktor                          | Risk | Value | Cost | Sprint est. |
|-----------------------------------|------|-------|------|-------------|
| Wynieść logikę z OrderController  | 3    | 2     | 1    | 1 sprint    |
| Dodać Groups do encji w API       | 3    | 3     | 1    | 1 sprint    |

### P1 — Ważne (następny kwartał)
| Refaktor                          | Risk | Value | Cost | Sprint est. |
|-----------------------------------|------|-------|------|-------------|
| ACL dla Stripe integration        | 2    | 2     | 2    | 2 sprinty   |
| ValueObjects dla Money/Email      | 2    | 3     | 2    | 2 sprinty   |

### P2 — Warto kiedyś
| Refaktor                          | Risk | Value | Cost | Sprint est. |
|-----------------------------------|------|-------|------|-------------|
| Wyodrębnić moduł Billing          | 1    | 3     | 3    | 1 kwartał   |
```

---

# Format outputu finalnego

Audyt kończy się **4 dokumentami**:

1. `audit-phase1-inventory.md` — mapa repo, moduły, kandydaci BC
2. `audit-phase2-diagnosis.md` — tabela rozjazdów z severity
3. `audit-phase3-roadmap.md` — priorytetyzowana roadmapa refaktorów
4. `audit-executive-summary.md` — 1-2 strony dla menedżera

**Struktura executive summary:**
```markdown
# Architectural Audit — Executive Summary

## Stan systemu (1 akapit)
Krótki opis: co działa dobrze, co jest największym problemem.

## Top 3 ryzyka (lista)
Konkretne zagrożenia dla biznesu — nie techniczne, ale biznesowe konsekwencje.

## Rekomendowane działania (lista P0)
Co zrobić w najbliższym sprincie / miesiącu.

## Szacunkowy koszt (tabela)
| Zakres          | Czas      | Zespół    |
|-----------------|-----------|-----------|
| P0 refaktory    | 2 sprinty | 2 devs    |
| P1 refaktory    | 1 kwartał | 3 devs    |

## Co się stanie jeśli nie działamy (1 akapit)
Scenariusz bez refaktoringu — rosnący koszt feature developmentu, ryzyko incydentów.
```
