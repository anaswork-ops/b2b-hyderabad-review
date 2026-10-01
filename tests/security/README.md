# Release security verification

Run `node tests/security/http.mjs` with SECURITY_API_BASE, SECURITY_FIXTURES (the private 500-user load fixture file), and ALLOW_ISOLATED_SECURITY=1 against the isolated API with trusted test ingress addresses. Tests exercise real middleware: headers, CORS, origin validation, CSRF, ownership, bounded input, body size, authentication abuse and cross-route shared rate limits. Do not run on the demo or production. Fixtures remain private. Run after load tests so rate-limit fixtures do not affect capacity measurement.

The API integration suites additionally cover staff MFA, role denial, suspended-business access, revocation, upload type/private access, cross-business ownership, moderation filtering and audit immutability. Run dependency audit and review tracked files/build contexts for secrets before release. A passing automated suite is scoped evidence, not a penetration-test certification.
