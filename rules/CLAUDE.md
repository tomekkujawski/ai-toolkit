# Project Overview

<!-- TO BE FILLED: 2-3 sentence description of what this project does, its primary domain, and key stakeholders. -->

# Tech Stack

- PHP 8.2+ (strict_types, readonly properties, named arguments)
- Symfony 7+
- Doctrine ORM 3+
- PostgreSQL / MySQL
- JMS Serializer (or Symfony Serializer — choose one and be consistent)
- PHPUnit 10+ with integration tests

# Domain Architecture

<!-- TO BE FILLED: list bounded contexts, their ownership, and key aggregates per context.

Example:
## Bounded Contexts
- **Ordering** — Order, OrderItem, OrderStatus. Owner: @backend-team
- **Catalog** — Product, Category, PriceList. Owner: @catalog-team
- **Payments** — Payment, Refund, PaymentMethod. Owner: @payments-team
-->

# Working Guidelines for AI Agents

## Code review

- ALWAYS check for: SQL injection (concatenation in native queries), missing Symfony Voter / `#[IsGranted]`, missing JMS `#[Groups]` causing data leaks, N+1 query risk in loops, missing Doctrine migrations after entity changes, business logic in controllers, missing unit tests for new logic.
- Use `@tomekkujawski/ai-toolkit` skill `code-review-php-symfony` for the full 7-criteria checklist with examples.
- Any **Critical** finding blocks the PR. **Warning** findings should be discussed before merging.

## Architectural audit

- Use `@tomekkujawski/ai-toolkit` skill `architect-audit` for the 3-phase audit pattern (Inventory → Diagnosis → Roadmap).
- Output: 4 documents — phase reports + executive summary.

## Coding standards

- `declare(strict_types=1);` in every new file — no exceptions.
- Type hints on all parameters and return types — avoid `mixed` unless genuinely needed.
- Constructor injection only — no `@Required`, no service locator pattern.
- ValueObjects for domain primitives with constraints (money, email, UUID, status enum).
- `readonly` for immutable ValueObjects and DTO properties.
- Domain events dispatched via a dedicated service or event dispatcher — not triggered inside entity setters.
- No `$em->flush()` inside loops — batch or defer to the end of the use case.

## Naming conventions

- Services: `<Domain><Action>Service` (e.g., `OrderPlacementService`)
- Repositories: `<Entity>Repository` implementing a domain interface
- Commands / queries (CQRS): `<Action><Entity>Command` / `<Entity>Query`
- Events: `<Entity><PastTense>Event` (e.g., `OrderPlacedEvent`)

## Symfony-specific

- Use `#[IsGranted]` attribute on controller actions — prefer it over `denyAccessUnlessGranted()` for clarity.
- Voter pattern for all resource-based authorization decisions.
- Form types for user input validation in web forms; constraints (`#[Assert\...]`) on DTOs for API input.
- API responses go through DTO → serializer pipeline, never raw entities.

# Testing Strategy

- **Unit tests**: all public methods in Service layer, ValueObjects, domain logic. No external dependencies — mock at boundaries.
- **Integration tests**: API endpoints tested against a real database (test schema). Use `KernelTestCase` / `WebTestCase`.
- **Coverage gate**: new code introduced in a PR should aim for ≥70% line coverage. Critical paths (payment, auth) require 90%+.
- Test file location mirrors `src/` structure under `tests/` — `src/Service/OrderService.php` → `tests/Service/OrderServiceTest.php`.
