# Todo authorization and deployment

The todo API authorizes every operation using the caller's authenticated Cognito
tenant and immutable `username`. The sample provisions users with their email
address as this username. The mutable `preferred_username` is a display name
and does not authorize access. The Cognito subject is required and is recorded
as the creator's `sub` when a todo is created.

- Creation generates the item ID and dates on the server and assigns the caller's
  tenant, subject, and username. Matching identity fields from the existing
  frontend are accepted; a matching initial display name is only a compatibility
  hint and is never stored as the owner. Forged tenant, creator, or unrelated
  initial ownership fields are rejected.
- A read returns an item only when its tenant matches and its owner list includes
  the caller.
- Updates and deletes check the existing item's tenant and ownership in the
  DynamoDB write condition. Updating a nonexistent item cannot create a record.
  Updates preserve its creator, tenant, and creation date.
- An existing owner can share a todo with additional immutable usernames. All recipients
  must still authenticate to the item's tenant to access it. Owner lists must
  include the caller, contain nonempty usernames, and have at most 50 entries.
- Subscriptions require the same identity claims and filter events by both tenant
  and username. Registration uses a NONE data source and does not scan the table.

`TodoInput` retains its existing fields to support the included frontend. On
update, `sub` and `createdAt` are ignored, `updatedAt` is server-generated, and a
supplied `tenantId` must match the authenticated tenant. Content and completion
status can be updated without resending every item field.

The app client retains write permission for required standard attributes, including
`preferred_username`, as Cognito requires. Changing this display name does not
change the user's immutable ownership identity. Custom tenant and administrator
attributes remain outside the app client's write permissions.

The included frontend creates a todo with content only; the server supplies
identity fields. Its sharing prompt accepts the recipient's sign-in email.

## Offline verification

From `backend-resources/cdk-ts-amplify-backend-resource`, install the backend and
the three Lambda packages used by the security tests, then run Jest:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix lib/lambda-code/admin-rest-api
npm ci --ignore-scripts --prefix lib/lambda-code/cognito-triggers/tokengen
npm ci --ignore-scripts --prefix lib/lambda-code/statemachine-functions/extract-cognito-groups
npm test -- --runInBand
```

For the whole-project type check, also install the separately packaged Lambda
dependencies and run `npm run check`:

```sh
npm ci --ignore-scripts --prefix lib/lambda-code/statemachine-functions/adminAddUserToGroupLambda
npm ci --ignore-scripts --prefix lib/lambda-code/statemachine-functions/adminCreateUserLambda
npm ci --ignore-scripts --prefix lib/lambda-code/statemachine-functions/adminCreateUserPoolGroupLambda
npm run check
```

The tests do not call AWS APIs or require customer data. The VTL tests execute the
actual request and response templates, while the CDK assertions check resolver
authentication and wiring.

## Isolated live validation

The optional live runner requires Node 22 or later and AWS CLI v2. Use an explicitly
selected non-production account and region. The validation stack reuses the
sample's resolver registration and app-client permissions. It creates a temporary
Cognito pool, authenticated AppSync API, DynamoDB table, and scoped IAM roles.
It does not deploy the frontend or require CDK bootstrap resources.

For a fresh `todo-auth-validation-*` stack name, synthesize a template into a
directory outside this repository:

```sh
npm run validation:synth -- \
  --account <account-id> --region <region> \
  --stack-name todo-auth-validation-<unique-suffix> --output <temporary-directory>
```

Create that stack with CloudFormation, passing `CAPABILITY_IAM` and the stack tag
`purpose=todo-authorization-validation`. After creation completes, run:

```sh
npm run validation:run -- \
  --profile <test-profile> --account <account-id> --region <region> \
  --stack-name todo-auth-validation-<unique-suffix> --report <private-report-path>
```

The runner checks the account, stack name, purpose tag, and outputs before creating
synthetic users. It verifies anonymous denial before adding test data, then checks
CRUD authorization, forged identity fields, sharing, lists,
mutable display-name impersonation attempts, ownership revocation, and
all three subscriptions. Subscription exclusions
use a bounded observation window and positive controls for each user's connection.
The final DynamoDB count checks that denied writes left no unexpected records.

AWS CLI profile credentials, passwords, and JWTs stay in memory and are omitted
from the report. Synthetic users
are removed in the runner's cleanup. Delete the dedicated CloudFormation stack
after collecting results, including if a test fails.

This focused stack has no Cognito Lambda triggers and signs users in by username.
It permits matching display names across tenants and tests a display-name change
followed by a fresh token. Offline tests also exercise matching immutable usernames
across tenant contexts. A passing run validates the shared resolvers and permissions, while a
full application's provisioning, UI, and custom integrations still need their
own checks.

## Existing deployments

Changes to this repository do not update deployed applications automatically.
Before releasing a backend update:

1. Review the patch and its customer impact with Security and the application's
   owner. Check custom clients' owner-name conventions and sharing behavior.
2. Review and migrate existing todo owner lists from legacy display names to
   immutable Cognito usernames before rollout. Use trusted provisioning/audit
   records; do not grant access solely by matching a current mutable display name.
   Ambiguous or suspect records require investigation. Legacy names that do not
   match a canonical username will fail closed until reviewed and migrated.
3. Redeploy the CDK backend and frontend together, including the AppSync mapping
   templates and subscription data source. No user-pool schema change or todo
   table replacement is intended.
4. Refresh user sessions and check token lifetimes. Previously issued JWTs remain
   valid until expiration; revoking a refresh token alone does not necessarily
   invalidate a JWT that AppSync accepts. Review account deletion and username reuse,
   and any other app clients that can write authorization attributes.
5. Review existing todos for forged tenant, creator, or owner fields. The fix
   prevents new unauthorized operations; it does not establish the provenance of
   existing records. Investigate suspect records before using them.
6. Validate authorized CRUD, same-tenant sharing, and all three subscriptions with
   two users in one tenant and a user in another tenant. Confirm denial of reads
   and writes by users outside the permitted tenant and owner set.

The offline tests execute the actual mapping templates and check the synthesized
resolver configuration. They do not replace AppSync/DynamoDB integration testing
or Security validation of a deployed test environment.
