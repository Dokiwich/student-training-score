# DATABASE CONSTITUTION

## Universal Database Engineering Rules + Database-Type Adapters

---

# 0. PURPOSE

This constitution governs AI coding agents working with:

* relational databases
* document databases
* key-value databases
* cache/data-structure stores
* wide-column databases
* graph databases
* search engines
* vector databases
* analytical databases
* database-backed application services
* migrations, data lifecycle, auditing, recovery and operational tooling

The objective is not to force every database into one design philosophy.

The objective is:

> **Use the right data model, integrity strategy, lifecycle, consistency model, operational model and scaling strategy for the actual database technology and workload.**

Core principle:

> **Correctness first. Performance second. Scale last.**

Foundation is mandatory regardless of project size.

Complex distributed architecture must be introduced only when measurable requirements justify it.

---

# 1. RULE LEVELS

Each rule has one of four levels.

## MUST

Mandatory unless a higher-priority instruction explicitly overrides it.

## SHOULD

Default engineering behavior.

Deviation is permitted only for a concrete technical or domain reason.

## MAY

Optional technique.

Use only when appropriate for the actual architecture.

## STOP

The agent must stop the current implementation path and investigate before continuing.

---

# 2. RULE PRECEDENCE

When rules conflict, use:

```text
System / Platform Instructions
        ↓
Developer Instructions
        ↓
Direct User Requirements
        ↓
More-Specific Repository / Directory Rules
        ↓
Selected Database Adapter
        ↓
Universal Database Core
        ↓
General Coding Preferences
```

A database-specific rule overrides a universal rule when the universal rule would be technically inappropriate for that database technology.

Example:

```text
Universal:
Prefer structured relationships.

Relational adapter:
Use normalized relational structures and foreign keys where appropriate.

Document adapter:
Choose embedding vs referencing according to access patterns.
```

Do not apply the relational rule to MongoDB merely because this file contains relational guidance.

---

# 3. DATABASE TYPE DETECTION

## MUST 3.1 — Detect the actual persistence technology

Before making a substantial database change, inspect the repository for:

* database client libraries
* ORM/ODM configuration
* schema files
* migration files
* connection configuration
* deployment configuration
* infrastructure configuration
* existing query patterns

Examples include:

```text
Prisma
Drizzle
TypeORM
SQLAlchemy
Entity Framework
Hibernate
Mongoose
MongoDB Driver
Redis
Cassandra
Neo4j
Elasticsearch
OpenSearch
Qdrant
Milvus
pgvector
BigQuery
Snowflake
ClickHouse
```

Do not infer database type from the project name.

---

## MUST 3.2 — Identify the active database adapter

Determine which adapter applies:

```text
RELATIONAL
DOCUMENT
KEY_VALUE
WIDE_COLUMN
GRAPH
SEARCH
VECTOR
ANALYTICAL
```

The agent may activate more than one adapter when the project intentionally uses multiple data systems.

---

## STOP 3.3 — Conflicting or unclear database architecture

Stop when:

* multiple databases exist but ownership is unclear,
* the same data appears to have multiple sources of truth,
* an ORM configuration conflicts with deployment configuration,
* the target database is uncertain,
* a migration technology does not match the apparent production database.

Do not guess.

---

# 4. UNIVERSAL CORE

The following rules apply to every database technology unless the selected adapter explicitly defines a technically different mechanism.

---

# 4A. CORE MODELING

## MUST 4.1 — Understand the data model before coding

Before modifying persistent data structures, identify:

* entities or logical data objects
* relationships or references
* ownership
* source of truth
* lifecycle
* important invariants
* access patterns
* retention requirements

---

## SHOULD 4.2 — Model before implementation

For non-trivial changes, create or inspect an appropriate model representation:

```text
ERD
schema diagram
document model
access-pattern model
graph model
index mapping
vector collection model
warehouse model
```

Use the representation appropriate to the database.

Do not force an ERD onto a system where an ERD is not the meaningful model.

---

## MUST 4.3 — Define the source of truth

For every important piece of data, know where authoritative state lives.

Do not create multiple competing authoritative copies without a synchronization strategy.

---

## MUST 4.4 — Preserve semantic integrity

A successful database operation is not automatically a correct database operation.

The agent must preserve:

* domain invariants
* ownership
* relationship validity
* allowed state transitions
* data lifecycle
* consistency requirements

---

# 4B. CORE DATA INTEGRITY

## MUST 4.5 — Use the strongest appropriate integrity mechanism

An invariant may be enforced at one or more levels:

```text
database
service/domain
application validation
```

Use the strongest practical mechanism appropriate to the technology.

Do not rely on UI validation alone for important invariants.

---

## MUST 4.6 — Never weaken integrity to hide a bug

Do not solve failures by casually:

* removing constraints
* deleting validation
* allowing invalid states
* disabling integrity checks
* making required data optional
* ignoring consistency errors

Investigate the root cause.

---

# 4C. CORE SECURITY

## MUST 4.7 — Least privilege

Application processes must use credentials appropriate to their permissions.

Do not use root/admin credentials as normal application credentials.

---

## MUST 4.8 — Protect secrets

Never commit:

* passwords
* connection strings
* API keys
* tokens
* encryption keys
* private certificates

to Git.

---

## MUST 4.9 — Never store plaintext passwords

Password handling belongs to the authentication/security layer.

Persistent storage must contain only approved password hashes and related security metadata.

---

## MUST 4.10 — Parameterize untrusted input

All externally controlled values must be safely bound according to the database technology.

Never build injection-prone queries through string concatenation.

This applies to:

* SQL
* NoSQL query objects
* search DSL
* graph queries
* vector filters
* command/data structures

---

# 4D. CORE CHANGE MANAGEMENT

## MUST 4.11 — Persistent schema/configuration changes are versioned

When the technology supports migrations or versioned schema changes:

```text
schema change
→ migration/change script
→ version control
```

Do not modify production structure manually as the normal workflow.

For schema-less systems, version changes through appropriate:

* collection/index migrations
* mapping changes
* application compatibility
* data migration scripts
* infrastructure-as-code

---

## MUST 4.12 — Do not rewrite shared change history

Once a migration or structural change has been applied to a shared environment, do not rewrite its history.

Create a new forward change.

---

## MUST 4.13 — Analyze compatibility before structural changes

Before changing:

* field names
* types
* indexes
* constraints
* collection/document shape
* graph properties
* search mappings
* vector dimensions
* partition keys

inspect existing consumers and data.

---

# 4E. CORE DATA LIFECYCLE

## MUST 4.14 — Model lifecycle deliberately

An entity or data object may be:

```text
ACTIVE
TRASHED
ARCHIVED
FINALIZED
HISTORICAL
VERSIONED
EXPIRED
HARD-DELETED
```

as appropriate.

Do not assume every object requires the same lifecycle.

---

## MUST 4.15 — Soft delete is optional, not universal

Soft deletion may be implemented when the domain requires:

* recovery
* historical preservation
* delayed deletion
* referential preservation
* retention policies

Do not automatically add:

```text
is_deleted
deleted_at
```

to every database object.

---

## MUST 4.16 — Trash and permanent deletion are different operations

When soft deletion exists:

```text
ACTIVE
   ↓
TRASHED
   ├── RESTORE → ACTIVE
   └── PERMANENT DELETE → REMOVED
```

Permanent deletion must be explicitly controlled.

---

# 4F. CORE AUDIT AND HISTORY

## MUST 4.17 — Important changes must be traceable when required by the domain

Where auditing is required, capture appropriate information such as:

```text
who
what
when
before
after
reason
request/correlation ID
source
```

---

## MUST 4.18 — Current state is not the same as history

Fields such as:

```text
updated_at
updated_by
```

do not automatically provide historical traceability.

Use versioning or audit records when the domain requires historical reconstruction.

---

## SHOULD 4.19 — Audit history should be append-oriented

Do not allow ordinary CRUD operations to casually modify or erase historical audit records.

---

# 4G. CORE SERVICE INTEGRATION

## MUST 4.20 — Database must have a deliberate application boundary

Preferred structure:

```text
UI / Controller / API
          ↓
Application Service
          ↓
Repository / Data Access
          ↓
Database Client
          ↓
Database
```

The exact layer names may differ by architecture.

---

## MUST 4.21 — Business workflows belong in the service/domain layer

Operations with domain meaning should be explicit:

```text
submit
approve
reject
finalize
restore
archive
permanentlyDelete
```

Do not expose generic unrestricted mutations when the domain requires controlled workflows.

---

## MUST 4.22 — Persistence mechanics belong in the data-access layer

Repository/data-access components should own:

* database queries
* persistence mapping
* database-specific mechanics
* query composition

Services should own:

* business workflows
* orchestration
* business invariants
* authorization decisions

Do not duplicate database logic across unrelated services.

---

## MUST 4.23 — Cross-layer impact analysis

When changing persistent data, inspect:

```text
Database / Schema
↓
Migration
↓
Repository
↓
Service
↓
API
↓
Validation
↓
UI
↓
Background jobs
↓
Reports
↓
Tests
```

---

# 4H. CORE TRANSACTIONS AND CONSISTENCY

## MUST 4.24 — Atomic related changes must be atomic

When multiple changes must either all succeed or all fail, use the appropriate atomicity mechanism supported by the database.

---

## MUST 4.25 — Understand the actual consistency model

Determine whether the operation requires:

```text
strong consistency
transactional consistency
eventual consistency
read-after-write consistency
optimistic concurrency
idempotency
```

Do not assume every database provides the same guarantees.

---

## MUST 4.26 — Concurrency must be considered for read-modify-write

Before changing concurrent logic, consider:

* race conditions
* lost updates
* duplicate creation
* stale data
* locking
* isolation
* retries
* idempotency

---

# 4I. CORE BACKUP AND RECOVERY

## MUST 4.27 — Important data needs a recovery strategy

Define appropriate:

* backup
* retention
* recovery procedure
* restore mechanism

---

## MUST 4.28 — A backup is not fully trusted until restoration is verified

A backup that exists but cannot be restored is not a dependable recovery mechanism.

For important systems, periodically test restore procedures.

---

## SHOULD 4.29 — Define RPO and RTO when operationally relevant

```text
RPO = acceptable data loss window
RTO = acceptable recovery time
```

Do not invent arbitrary values; derive them from system requirements.

---

# 4J. CORE PERFORMANCE

## MUST 4.30 — Measure before optimizing

Use technology-appropriate evidence:

```text
query plans
slow query logs
latency
CPU
memory
I/O
connection usage
storage growth
cache hit rate
replication lag
```

---

## MUST 4.31 — Do not introduce complexity solely for hypothetical scale

Do not add:

```text
sharding
multi-region
Kafka
multiple independent databases
distributed cache
warehouse
```

without an actual requirement.

---

## SHOULD 4.32 — Prefer the simplest architecture that satisfies the measured workload

Optimize progressively:

```text
Correct model
→ Correct query
→ Appropriate index
→ Appropriate caching
→ Appropriate partitioning
→ Read scaling
→ Distributed architecture
```

Only progress when evidence requires it.

---

# 4K. CORE DESTRUCTIVE OPERATIONS

## MUST 4.33 — Destructive operations require explicit scope

Before:

```text
DROP
TRUNCATE
DELETE
destructive migration
bulk transformation
permanent deletion
```

verify:

* environment
* target
* affected data
* dependencies
* recovery strategy
* authorization

---

## STOP 4.34 — Ambiguous destructive operation

Stop when the target or scope is unclear.

Never guess.

---

# 5. RELATIONAL DATABASE ADAPTER

## Applies to

```text
PostgreSQL
MySQL / MariaDB
SQL Server
Oracle
SQLite
and similar relational databases
```

---

# 5A. RELATIONAL MODELING

## MUST R5.1 — Normalize by default

Target appropriate normalization, normally up to 3NF for transactional relational systems.

Do not denormalize without evidence and a defined consistency strategy.

---

## MUST R5.2 — Deliberately model primary keys

Each entity table must have an intentional identity strategy.

Use:

* surrogate key
* natural key
* composite key

according to domain requirements.

---

## MUST R5.3 — Use foreign keys for enforceable referential integrity

When the database is the appropriate integrity boundary, use foreign keys rather than relying exclusively on application code.

---

## MUST R5.4 — Use constraints for relational invariants

Use appropriate:

```text
PRIMARY KEY
FOREIGN KEY
UNIQUE
NOT NULL
CHECK
```

where supported and meaningful.

---

# 5B. RELATIONAL INDEXING

## MUST R5.5 — Design indexes around real query patterns

Consider:

```text
WHERE
JOIN
ORDER BY
GROUP BY
UNIQUE
foreign-key access
```

---

## MUST R5.6 — Check redundant indexes before adding new ones

Inspect:

* current indexes
* column order
* coverage
* query patterns

before creating another index.

---

## SHOULD R5.7 — Verify with EXPLAIN where performance matters

Use:

```sql
EXPLAIN
```

or database-specific plan analysis.

---

# 5C. RELATIONAL QUERIES

## MUST R5.8 — Avoid unnecessary SELECT *

Retrieve required columns where practical.

---

## MUST R5.9 — Use pagination for large result sets

Do not load unbounded tables into application memory.

---

## MUST R5.10 — Avoid N+1 queries

Inspect relation loading and joins.

---

## MUST R5.11 — Prefer set-based operations where safe

Do not use application loops for operations that the database can safely perform as a set.

---

# 5D. RELATIONAL TRANSACTIONS

## MUST R5.12 — Use transactions for atomic workflows

Examples:

```text
create order
+
create order items
+
update inventory
```

or:

```text
submit scoring sheet
+
change state
+
write audit record
```

when all operations must be atomic.

---

## SHOULD R5.13 — Keep transactions short

Never hold relational transactions across unnecessary external work.

---

# 5E. RELATIONAL DATA TYPES

## MUST R5.14 — Exact numeric data must use exact numeric types

For monetary values requiring exact arithmetic, use DECIMAL/NUMERIC rather than floating-point representation.

---

## SHOULD R5.15 — Use a consistent time convention

Use a documented timestamp strategy.

UTC should normally be the canonical storage/transport convention for distributed backends unless the architecture explicitly requires otherwise.

---

# 6. DOCUMENT DATABASE ADAPTER

## Applies to

```text
MongoDB
Couchbase
Firestore-like document systems
and similar document stores
```

---

# 6A. DOCUMENT MODELING

## MUST D6.1 — Do not force 3NF onto document databases

Normalization is not automatically the objective.

Choose between:

```text
embedding
referencing
```

according to:

* access patterns
* update frequency
* document size
* consistency requirements
* relationship cardinality

---

## MUST D6.2 — Design around access patterns

Before creating a document structure, identify:

* common reads
* common writes
* filtering patterns
* update patterns
* document growth

---

## MUST D6.3 — Control document growth

Do not create unbounded embedded arrays or documents that grow indefinitely when the database has document-size or operational limitations.

---

## MUST D6.4 — Embedded and referenced data require explicit ownership semantics

When using embedded data, determine whether it is:

```text
snapshot
authoritative state
duplicated read model
```

Do not create uncontrolled copies.

---

# 6B. DOCUMENT CONSISTENCY

## SHOULD D6.5 — Prefer atomic document updates where appropriate

If related data naturally belongs to one document and must change together, favor atomic document operations where supported.

---

## MUST D6.6 — Cross-document consistency must be deliberate

When data is referenced across documents, determine whether the system requires:

* transaction
* application coordination
* eventual consistency
* compensation
* reconciliation

Do not assume document references provide relational-style referential integrity.

---

# 6C. DOCUMENT INDEXING

## MUST D6.7 — Index actual query paths

Build indexes around actual filter/sort/access patterns.

---

## SHOULD D6.8 — Monitor index and document size costs

Do not create indexes indiscriminately.

---

# 7. KEY-VALUE / CACHE ADAPTER

## Applies to

```text
Redis
Memcached
and similar key-value/cache systems
```

---

# 7A. KEY DESIGN

## MUST K7.1 — Keys require explicit conventions

Define:

```text
namespace
entity
identifier
version when required
```

Example:

```text
user:123
session:abc
score-sheet:2026:student:123
```

Use the project's established convention.

---

## MUST K7.2 — Define ownership and expiration

For each cached object, determine:

* owner
* TTL
* invalidation rule
* stale-data tolerance
* memory impact

---

## MUST K7.3 — Cache is not automatically the source of truth

Unless explicitly designed otherwise, cache systems should not replace the authoritative datastore.

---

## MUST K7.4 — Cache invalidation must be explicit

For mutable authoritative data, define what happens when the underlying record changes.

---

## MUST K7.5 — Handle cache failure gracefully

The application must have an appropriate behavior when the cache is unavailable.

Do not make an optional cache an unplanned single point of failure.

---

# 8. WIDE-COLUMN DATABASE ADAPTER

## Applies to

```text
Cassandra
ScyllaDB
HBase
and similar wide-column stores
```

---

# 8A. ACCESS-PATTERN FIRST

## MUST W8.1 — Design from known access patterns

Unlike a traditional normalized relational design, start with:

```text
What queries must this system perform?
```

Then design partitions and clustering around those queries.

---

## MUST W8.2 — Partition key is a first-class design decision

Before creating a table, analyze:

* partition size
* distribution
* hot partitions
* cardinality
* workload balance

---

## MUST W8.3 — Avoid unbounded partitions

Do not create a partition that grows without operational control.

---

## MUST W8.4 — Understand consistency behavior

Know which consistency level the operation requires.

Do not assume relational ACID semantics.

---

# 9. GRAPH DATABASE ADAPTER

## Applies to

```text
Neo4j
Amazon Neptune
and similar graph systems
```

---

# 9A. GRAPH MODELING

## MUST G9.1 — Model meaningful entities as nodes

Use nodes for domain entities where graph traversal is meaningful.

---

## MUST G9.2 — Model meaningful relationships explicitly

Do not flatten important relationships into opaque properties when relationship traversal is a primary access pattern.

---

## MUST G9.3 — Relationship semantics must be explicit

Determine:

* relationship type
* direction
* properties
* cardinality
* lifecycle

---

# 9B. GRAPH QUERY SAFETY

## MUST G9.4 — Design for traversal patterns

Optimize around actual traversals rather than imposing relational JOIN thinking onto graph workloads.

---

## MUST G9.5 — Bound expensive traversals

Do not execute unrestricted recursive/traversal queries against large graphs without understanding cost and result explosion.

---

# 10. SEARCH DATABASE ADAPTER

## Applies to

```text
Elasticsearch
OpenSearch
Solr
and similar search systems
```

---

# 10A. SEARCH AS A PROJECTION

## MUST S10.1 — Determine whether the search index is authoritative

In many architectures:

```text
Primary Database
      ↓
Search Index
```

The relational/document datastore remains the source of truth.

The agent must explicitly identify whether search is:

```text
authoritative
projection
cache
derived index
```

---

## MUST S10.2 — Search indexes require synchronization strategy

When data changes in the source datastore, define how the index is updated:

```text
synchronous
event-driven
queued
batch
periodic rebuild
```

---

## MUST S10.3 — Index mappings must be version-aware

Changing mappings, analyzers or field semantics can be breaking.

Treat mapping changes as controlled changes.

---

## MUST S10.4 — Reindexing must be considered for incompatible mapping changes

Do not mutate mapping semantics blindly when a fresh index and controlled reindex is safer.

---

# 11. VECTOR DATABASE ADAPTER

## Applies to

```text
Qdrant
Milvus
Weaviate
Pinecone
pgvector
and similar vector systems
```

---

# 11A. VECTOR DATA MODEL

## MUST V11.1 — Define vector identity

Each vector must have deliberate identity and ownership semantics.

---

## MUST V11.2 — Record vector provenance

Where relevant, preserve metadata such as:

```text
source entity
source document
embedding model
model version
created_at
content version
chunk identifier
```

---

## MUST V11.3 — Embedding dimensions must be compatible

Do not change embedding dimensionality or model semantics without analyzing:

* collection/index compatibility
* existing vectors
* retrieval behavior
* re-embedding requirements

---

## MUST V11.4 — Vector store is not automatically the source of truth

If vectors represent derived information from another datastore, keep the original source authoritative.

---

## MUST V11.5 — Metadata filters require consistency

Ensure vector metadata remains synchronized with the source data when filtering depends on:

* ownership
* permissions
* status
* category
* tenant
* lifecycle state

Never allow retrieval to expose data that the authoritative authorization model would reject.

---

# 12. ANALYTICAL DATABASE ADAPTER

## Applies to

```text
BigQuery
Snowflake
ClickHouse
Redshift
Databricks
data warehouses/lakehouses
```

---

# 12A. ANALYTICAL MODELING

## MUST A12.1 — Optimize for analytical workloads

Do not blindly apply OLTP modeling rules.

Consider:

```text
fact tables
dimension tables
star schema
partitioning
clustering
columnar storage
materialized views
```

according to workload.

---

## MUST A12.2 — Define data freshness

Determine whether analytical data should be:

```text
real-time
near-real-time
hourly
daily
batch
```

---

## MUST A12.3 — Define lineage

Important analytical datasets should identify:

```text
source
transformation
owner
refresh process
```

---

## MUST A12.4 — Separate transactional and analytical concerns when appropriate

Do not run large analytical workloads directly against an OLTP database if that materially harms transactional operations.

---

# 13. MULTI-DATABASE ARCHITECTURES

A project may intentionally use:

```text
PostgreSQL
+
Redis
+
Elasticsearch
+
Qdrant
```

or another combination.

---

## MUST M13.1 — Every datastore requires a defined responsibility

For each database/system, identify:

```text
purpose
source of truth
data owned
read/write responsibility
consistency relationship
failure behavior
backup/recovery
```

---

## MUST M13.2 — Do not duplicate ownership accidentally

Example:

```text
PostgreSQL
   ↓
Source of truth

Redis
   ↓
Cache

Elasticsearch
   ↓
Search projection

Qdrant
   ↓
Vector projection
```

Do not allow multiple systems to silently become authoritative for the same domain fact.

---

## MUST M13.3 — Cross-database synchronization must be explicit

When data exists in multiple systems, define:

* synchronization mechanism
* ordering assumptions
* retry behavior
* idempotency
* failure recovery
* reconciliation process

---

## MUST M13.4 — Do not assume distributed operations are atomic

A transaction across one datastore does not automatically make operations across several independent databases atomic.

Use appropriate:

* outbox
* event
* saga
* retry
* reconciliation

patterns when justified.

Do not introduce distributed coordination without a real need.

---

# 14. DATABASE-SERVICE-AUDIT ARCHITECTURE

For important systems, use:

```text
                   API / Controller
                          ↓
                  Application Service
                          ↓
                     Repository
                          ↓
                  Database Adapter
                          ↓
                    Data Store
                          │
                          ↓
                     Audit Trail
```

For multi-database systems:

```text
                 Application Service
                         ↓
              ┌──────────┼──────────┐
              ↓          ↓          ↓
          PostgreSQL   Redis    Search/Vector
             ↓
        Source of Truth
```

---

## MUST 14.1 — Business workflow must remain centralized

Do not duplicate the same business rule independently in:

* frontend
* repository
* search index
* cache
* database script

A rule may be validated at multiple boundaries, but there must be a clear authoritative owner.

---

## MUST 14.2 — Derived stores must not silently override source data

Caches, search indexes and vectors should normally be rebuilt from the source of truth where architecture permits.

---

# 15. DATABASE LIFECYCLE AND TRASH POLICY

For entities that support deletion:

```text
ACTIVE
   │
   ├── UPDATE
   │
   └── DELETE
         ↓
      TRASHED
       │   │
       │   └── RESTORE → ACTIVE
       │
       └── PERMANENT DELETE
```

---

## MUST 15.1

Trash must be implemented according to the database's appropriate mechanism.

For relational systems this may be:

```text
deleted_at
status
```

For document systems:

```text
deleted_at
status
```

For search systems it may require:

```text
source-state update
reindex
```

For vector systems it may require:

```text
metadata lifecycle state
delete/archive operation
```

Do not assume one implementation fits every database.

---

# 16. VERSIONING AND HISTORICAL DATA

Where historical reconstruction matters, use the mechanism appropriate to the datastore:

```text
audit log
append-only events
history table
version documents
event sourcing
immutable records
change streams
```

---

## MUST 16.1

The agent must distinguish:

```text
current state
```

from:

```text
historical state
```

---

## MUST 16.2

Never erase historical information merely because the current UI no longer needs it when the domain requires historical traceability.

---

# 17. SCALING POLICY

## MUST 17.1 — Scale progressively

### Small

Prefer:

```text
single appropriate datastore
good model
constraints
indexes
safe queries
backup
basic monitoring
```

### Medium

Consider:

```text
connection pooling
cache
read replicas
partitioning
PITR
stronger monitoring
```

### Large

Consider:

```text
multi-AZ
sharding
OLTP / OLAP separation
ETL / ELT
multi-region
distributed systems
```

Only when justified.

---

## MUST 17.2 — Do not infer scale from hypothetical future traffic

Use measured or explicitly required:

```text
QPS
latency
storage growth
CPU
memory
I/O
connection saturation
replication lag
search latency
vector retrieval latency
```

---

## MUST 17.3 — Keep foundational rules at every scale

Regardless of size, preserve:

```text
data integrity
security
versioned changes
backup
recovery
appropriate auditing
safe queries
correct lifecycle
```

---

# 18. OVER-ENGINEERING CONTROL

## MUST 18.1 — Every major complexity increase requires a reason

Before introducing:

```text
sharding
Kafka
multi-region
multiple independent databases
distributed caching
warehouse
event sourcing
```

identify:

```text
problem
evidence
required property
chosen mechanism
trade-off
```

---

## SHOULD 18.2 — Prefer reversible decisions

When multiple designs satisfy current requirements, prefer the one that:

* is simpler
* is easier to test
* is easier to operate
* preserves future migration paths
* minimizes unnecessary coupling

---

# 19. PERFORMANCE INVESTIGATION WORKFLOW

When performance is a concern:

```text
1. Reproduce
      ↓
2. Measure
      ↓
3. Identify bottleneck
      ↓
4. Form hypothesis
      ↓
5. Implement minimal change
      ↓
6. Measure again
      ↓
7. Keep only verified improvement
```

Do not optimize from intuition alone.

---

# 20. MIGRATION SAFETY WORKFLOW

For any risky structural/data migration:

```text
DISCOVER
   ↓
CHECK EXISTING DATA
   ↓
IDENTIFY INCOMPATIBILITIES
   ↓
BACKUP / RECOVERY PLAN
   ↓
EXPAND
   ↓
BACKFILL
   ↓
MIGRATE APPLICATION
   ↓
VERIFY
   ↓
CONTRACT
```

Use only the steps appropriate to actual risk.

---

# 21. DATABASE CHANGE WORKFLOW

For every non-trivial change:

```text
PHASE 1 — DISCOVER
    ↓
PHASE 2 — IDENTIFY DATABASE TYPE
    ↓
PHASE 3 — MODEL
    ↓
PHASE 4 — IDENTIFY INVARIANTS
    ↓
PHASE 5 — DESIGN
    ↓
PHASE 6 — CHECK DATA COMPATIBILITY
    ↓
PHASE 7 — IMPLEMENT
    ↓
PHASE 8 — VERIFY
    ↓
PHASE 9 — REVIEW
```

---

# 22. PHASE 1 — DISCOVER

Inspect:

```text
database configuration
schema/model files
migrations
ORM/ODM/client
indexes
constraints
queries
repositories
services
API
tests
seeds
jobs
reports
deployment
backup/recovery setup
```

---

# 23. PHASE 2 — IDENTIFY DATABASE TYPE

Determine:

```text
Relational?
Document?
Key-value?
Wide-column?
Graph?
Search?
Vector?
Analytical?
Multi-database?
```

Activate only the applicable adapter rules.

---

# 24. PHASE 3 — MODEL

Determine the appropriate modeling approach.

Examples:

```text
Relational → ERD / normalization
Document → embedding/reference model
Redis → key/TTL model
Cassandra → partition/access-pattern model
Graph → nodes/relationships
Search → index/mapping model
Vector → collection/dimension/provenance model
Warehouse → facts/dimensions/lineage
```

---

# 25. PHASE 4 — IDENTIFY INVARIANTS

Explicitly determine:

```text
uniqueness
ownership
relationships
state
retention
authorization
consistency
concurrency
historical requirements
```

---

# 26. PHASE 5 — DESIGN

Choose:

```text
schema
constraints
indexes
transactions
consistency strategy
lifecycle
audit
migration
service integration
recovery
```

according to the active database adapter.

---

# 27. PHASE 6 — DATA COMPATIBILITY

Before changing structures, verify:

```text
existing records
duplicates
null/missing values
invalid references
document shape variants
index compatibility
mapping compatibility
embedding compatibility
partition behavior
```

---

# 28. PHASE 7 — IMPLEMENT

Modify only the necessary:

```text
schema
migration
database adapter
repository
service
API
validation
tests
seeds
documentation
```

Do not modify unrelated files.

---

# 29. PHASE 8 — VERIFY

Use the correct verification tools for the actual database.

Possible checks:

```text
schema validation
migration validation
unit tests
integration tests
database tests
query plans
slow query analysis
index validation
data integrity checks
restore verification
search/index validation
vector consistency checks
analytical pipeline validation
```

Do not perform irrelevant checks merely to satisfy a checklist.

---

# 30. PHASE 9 — FINAL REVIEW

Before declaring completion, verify:

```text
[ ] Correct database type identified
[ ] Correct modeling strategy used
[ ] Source of truth preserved
[ ] Invariants preserved
[ ] Appropriate integrity mechanisms used
[ ] Correct lifecycle implemented
[ ] Audit requirements satisfied
[ ] Service/repository integration correct
[ ] Concurrency risks considered
[ ] Migration/change history preserved
[ ] Existing data remains compatible
[ ] Security preserved
[ ] Recovery implications considered
[ ] Performance claims verified
[ ] No unnecessary infrastructure introduced
[ ] Relevant tests/checks pass
[ ] Only necessary files changed
```

---

# 31. STOP CONDITIONS

The agent MUST STOP when:

* database type is unclear,
* source of truth is unclear,
* two systems appear to own the same fact,
* migration may destroy data,
* current data may violate a proposed constraint,
* consistency requirements are unclear,
* business lifecycle is unclear,
* authorization ownership is unclear,
* transaction/concurrency behavior is unclear,
* index/mapping/partition strategy may cause severe operational risk,
* a destructive operation has ambiguous scope,
* recovery is impossible or undefined for important data,
* the agent does not understand the installed database/ORM version.

The agent must inspect, verify or report the uncertainty.

Never guess.

---

# 32. FORBIDDEN SHORTCUTS

Never:

```text
disable integrity merely to make code pass
```

Never:

```text
remove constraints because they are inconvenient
```

Never:

```text
use admin/root credentials as the normal application identity
```

Never:

```text
commit secrets
```

Never:

```text
store plaintext passwords
```

Never:

```text
use unsafe/unparameterized queries
```

Never:

```text
delete historical/audit data through normal CRUD
```

Never:

```text
apply soft-delete universally
```

Never:

```text
force 3NF onto non-relational databases
```

Never:

```text
force relational JOIN-based design onto graph databases
```

Never:

```text
force document modeling onto relational databases
```

Never:

```text
assume cache/search/vector stores are authoritative without explicitly defining them as such
```

Never:

```text
introduce sharding, multi-region or distributed systems solely because they sound scalable
```

Never:

```text
claim a performance improvement without measurement when measurement is feasible
```

Never:

```text
declare completion merely because the application starts
```

---

# 33. UNIVERSAL FINAL PRINCIPLE

The agent must always determine:

```text
WHAT KIND OF DATABASE IS THIS?
          ↓
WHAT IS THE DATA MODEL?
          ↓
WHAT IS THE SOURCE OF TRUTH?
          ↓
WHAT MUST ALWAYS REMAIN TRUE?
          ↓
WHAT IS THE CONSISTENCY MODEL?
          ↓
WHAT IS THE DATA LIFECYCLE?
          ↓
WHAT IS THE RECOVERY REQUIREMENT?
          ↓
WHAT DOES THE SERVICE LAYER OWN?
          ↓
WHAT DOES THE DATABASE OWN?
          ↓
WHAT DOES MEASUREMENT SAY?
          ↓
WHAT IS THE SIMPLEST CORRECT SOLUTION?
```

Final rule:

> **Do not make every database behave like a relational database.**
>
> **Do not make every project behave like an enterprise system.**
>
> **Do not sacrifice foundational integrity because a project is small.**
>
> **Do not introduce heavy architecture because a project might become large.**
>
> **Use the database technology according to its actual strengths, constraints and workload.**
>
> **Correctness first. Performance second. Scale last.**
