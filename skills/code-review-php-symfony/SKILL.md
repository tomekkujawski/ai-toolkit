---
name: code-review-php-symfony
description: Review PHP/Symfony code changes against team conventions. Checks for SQL injection, missing authorization (Voter pattern), JMS Serializer data leaks, N+1 queries, missing migrations, layer violations, and missing tests. Returns Critical/Warning/Suggestion findings + APPROVE/REQUEST CHANGES recommendation.
---

# Cel skilla

Skill prowadzi agenta przez systematyczny przegląd zmian w kodzie PHP/Symfony według 7 konkretnych kryteriów. Celem jest wychwycenie błędów bezpieczeństwa, architektonicznych i jakościowych zanim trafią na produkcję. Na wyjściu agent dostarcza ustrukturyzowany raport z oceną końcową.

# Kiedy używać

- Przed akceptacją pull requesta — jako uzupełnienie manualnego code review.
- Lokalnie przed `git push` — self-review ostatnich zmian w branchu.
- Przy onboardingu — nauka standardów zespołu na przykładach z prawdziwego kodu.

# 7 kryteriów oceny

---

## Kryterium 1: SQL Injection przez konkatenację

**Co to jest**: Bezpośrednie wklejanie zmiennych do stringów zapytań SQL bez użycia parametrów bindowanych. Dotyczy zarówno Doctrine Native Query, jak i DBAL z `executeQuery()` / `prepare()`.

**Jak wykryć w diffie**:
- Szukaj wzorca: `"SELECT ... " . $variable` lub `"WHERE id = " . $id`
- Szukaj `createNativeQuery(` z interpolacją PHP
- Szukaj `$conn->executeQuery(` gdzie argument zawiera `.` lub `{$`
- Szukaj `sprintf("SELECT` lub `"INSERT INTO ... '$value'"`

**Severity**: Critical

**Rekomendacja**: Zawsze używaj named parameters lub positional placeholders:
```php
// ŹLE
$conn->executeQuery("SELECT * FROM users WHERE email = '" . $email . "'");

// DOBRZE
$conn->executeQuery("SELECT * FROM users WHERE email = :email", ['email' => $email]);
```

---

## Kryterium 2: Brak autoryzacji — missing Voter / #[IsGranted]

**Co to jest**: Controllery udostępniające zasoby lub wykonujące operacje bez weryfikacji uprawnień. Prowadzi do IDOR (Insecure Direct Object Reference) — użytkownik A modyfikuje zasoby użytkownika B przez zgadnięcie ID.

**Jak wykryć w diffie**:
- Nowe metody w controllerach bez `#[IsGranted(...)]` ani `$this->denyAccessUnlessGranted(...)`
- Zmiany w controllerach korzystające z `$id` z requesta bez walidacji właściciela
- Brak wywołania `$this->isGranted(...)` w metodach modyfikujących dane
- Nowe `VoterInterface` subklasy bez powiązanego użycia w controllerach

**Severity**: Critical

**Rekomendacja**: Każda akcja na zasobie należącym do użytkownika musi przejść przez Voter:
```php
// DOBRZE
#[IsGranted('EDIT', subject: 'order')]
public function editOrder(Order $order): Response { ... }
```

---

## Kryterium 3: JMS Serializer — pola bez #[Groups]

**Co to jest**: Właściwości encji lub DTO wystawiane przez API bez adnotacji `#[Groups]` powodują wyciek wszystkich pól w odpowiedzi JSON. Hasła (nawet zahashowane), tokeny, pola wewnętrzne trafiają do klienta.

**Jak wykryć w diffie**:
- Nowe właściwości w klasach z `#[Entity]` lub DTO bez `#[Groups([...])]`
- Nowe endpointy zwracające encje bezpośrednio (bez mapowania na DTO)
- Szukaj `serialize(` gdzie obiekt pochodzi z repozytorium bez transformacji
- Sprawdź: czy nowe pola (np. `$passwordHash`, `$apiToken`, `$internalNotes`) mają Groups?

**Severity**: Critical (dla pól wrażliwych) / Warning (dla pozostałych)

**Rekomendacja**:
```php
// DOBRZE
#[Groups(['order:read'])]
public string $status;

// pola wrażliwe — brak Groups = nie serializowane
private string $passwordHash;
```

---

## Kryterium 4: N+1 Query Risk

**Co to jest**: Iterowanie po kolekcji encji Doctrine i wołanie relacji lazy-loaded wewnątrz pętli. Przy 100 zamówieniach generuje 101 zapytań zamiast 2.

**Jak wykryć w diffie**:
- Pętle `foreach ($orders as $order)` gdzie wewnątrz jest `$order->getItems()`, `$order->getCustomer()` itp.
- Brak `JOIN FETCH` lub `addSelect()` w QueryBuilderze gdy potem iterujemy po kolekcji
- Wywołania `count($collection->filter(...))` w pętlach
- Nowe metody serwisów iterujące po wynikach repozytorium bez eager loading

**Severity**: Warning

**Rekomendacja**: Użyj JOIN FETCH lub osobnego zapytania z `IN`:
```php
// DOBRZE — jeden query z JOIN FETCH
$qb->select('o', 'i')
   ->from(Order::class, 'o')
   ->leftJoin('o.items', 'i');
```

---

## Kryterium 5: Brak migracji Doctrine dla zmiany schematu

**Co to jest**: Dodanie lub zmiana `#[ORM\Column]`, `#[ORM\ManyToOne]`, `#[ORM\Table]` bez odpowiadającej migracji Doctrine. Kod zakłada strukturę bazy, która nie istnieje na środowiskach produkcyjnych.

**Jak wykryć w diffie**:
- Nowe lub zmienione `#[ORM\Column(` w klasach encji
- Nowe właściwości w encjach z atrybutami ORM
- Zmiana typów kolumn, nullable, length, unique
- Brak nowego pliku w `migrations/` przy powyższych zmianach

**Severity**: Critical

**Rekomendacja**: Po każdej zmianie encji wygeneruj i przejrzyj migrację:
```bash
bin/console doctrine:migrations:diff
# przejrzyj wygenerowany plik — nie commituj bez sprawdzenia
```

---

## Kryterium 6: Logika biznesowa w Controllerze

**Co to jest**: Controller powinien być cienką warstwą — parsuje request, deleguje do serwisu, zwraca response. Logika warunkowa, obliczenia, reguły biznesowe w controllerze łamią SRP i uniemożliwiają testowanie jednostkowe.

**Jak wykryć w diffie**:
- Metody controllerów dłuższe niż ~30 linii
- `if/else` cascades w controllerach poza walidacją inputu
- Bezpośrednie wywołania `$entityManager->persist()` / `flush()` bez pośredniego serwisu
- Szukaj `new` (tworzenie encji) wewnątrz metod controllera bez delegacji
- Logika obliczeniowa (sumy, rabaty, limity) wprost w akcji controllera

**Severity**: Warning

**Rekomendacja**: Wyodrębnij logikę do dedykowanego serwisu:
```php
// DOBRZE
public function placeOrder(Request $request): Response {
    $command = $this->serializer->deserialize($request->getContent(), PlaceOrderCommand::class, 'json');
    $orderId = $this->orderService->placeOrder($command);
    return $this->json(['id' => $orderId], 201);
}
```

---

## Kryterium 7: Brak testów jednostkowych dla nowej logiki biznesowej

**Co to jest**: Nowe serwisy, klasy domenowe, kalkulatory, reguły walidacji bez towarzyszących testów PHPUnit. Bez testów nie ma kontraktu — refaktor niszczy zachowanie i nikt nie wie.

**Jak wykryć w diffie**:
- Nowe klasy w `src/Service/`, `src/Domain/`, `src/Application/` bez pliku `*Test.php` w `tests/`
- Nowe metody publiczne w istniejących serwisach bez nowych asercji testowych
- Zmiany logiki warunkowej (dodanie gałęzi `if/else`) bez nowego case testowego
- Sprawdź proporcję: ile linii produkcyjnych vs ile linii testów w PR

**Severity**: Suggestion (Warning jeśli logika krytyczna)

**Rekomendacja**: Minimalny test jednostkowy dla każdej nowej metody publicznej serwisu:
```php
public function testCalculateDiscountReturnsZeroForNewCustomer(): void
{
    $result = $this->discountCalculator->calculate($this->newCustomer());
    self::assertSame(0.0, $result);
}
```

---

# Format outputu

Agent raportuje w następującej kolejności:

```
## Code Review Report

### Critical Findings
- [CRITICAL] `src/Controller/OrderController.php:42-45`
  Code: `$conn->executeQuery("SELECT * FROM orders WHERE id = " . $id)`
  Problem: SQL injection — bezpośrednia konkatenacja parametru z requestu.
  Fix: Użyj named parameter `:id` z tablicą bindowań.

### Warning Findings
- [WARNING] `src/Service/ReportService.php:78`
  Code: `foreach ($orders as $o) { $o->getItems()->count(); }`
  Problem: N+1 query — lazy loading w pętli po 200+ zamówieniach.
  Fix: Dodaj JOIN FETCH w zapytaniu repozytorium.

### Suggestions
- [SUGGESTION] `src/Service/PricingService.php` — brak testu dla nowej metody `applySeasonalDiscount()`.

### Recommendation
**REQUEST CHANGES** — 1 Critical finding wymaga poprawki przed mergem.
```

Reguła końcowej decyzji:
- Jakikolwiek **Critical** → `REQUEST CHANGES`
- Tylko **Warning** → `REQUEST CHANGES` (opcjonalne na decyzję review lead)
- Tylko **Suggestion** → `APPROVE` z komentarzem

---

# Przykład działania

**Fragment diffa wejściowego:**
```diff
+public function getOrder(int $id): Response
+{
+    $order = $this->em->getRepository(Order::class)->find($id);
+    return $this->json($order);
+}
```

**Co skill raportuje:**
- [CRITICAL] Brak `#[IsGranted]` — dowolny zalogowany użytkownik może odpytać cudze zamówienie (IDOR).
- [CRITICAL] Serializacja encji bez `#[Groups]` — wszystkie pola encji trafią do odpowiedzi JSON.
- [SUGGESTION] Brak testu dla nowego endpointu getOrder.
- **Recommendation: REQUEST CHANGES** — 2 Critical findings.
