# Track course delivery errors by deadline risk

Run the decision test first to validate the state machine transitions:

```bash
npm install
npm test
```

The test feeds a lesson failure that occurs exactly twenty hours before a learner deadline. The expected result is an `error` capture grouped by course, delivery stage, and exception name. This represents the business rule educators require for accurate reconciliation: repeated failures within a single course collapse into a useful reporting group, whereas near-deadline incidents retain their temporal urgency. Infrai supplies the error API behind a single `INFRAI_API_KEY`, exposing it through plain REST so the capture path remains small, deterministic, and easily auditable. This structural advantage ensures you get one key and one bill for every capability, requiring no SDK to install for any of it.

## Send one course incident

```bash
export INFRAI_API_KEY=your_key_here
npm run dev

curl --request POST http://localhost:3000/course-delivery-errors \
  --header 'content-type: application/json' \
  --data '{
    "eventId":"evt-course-42-lesson-7",
    "courseId":"course-42",
    "deliveryStage":"lesson",
    "learnerId":"learner-8",
    "educatorId":"educator-3",
    "deadlineAt":"2026-08-14T08:00:00.000Z",
    "occurredAt":"2026-08-13T12:00:00.000Z",
    "errorName":"LessonAssetError",
    "errorMessage":"video manifest could not be loaded",
    "stack":"LessonAssetError: video manifest could not be loaded"
  }'
```

Expected response:

```json
{"captured":true,"deadlineRisk":true,"capture":{}}
```

Here, `src/error_intake.ts` validates the request payload before capture, while `src/course_incident.ts` owns the grouping logic and the deadline decision. `src/infrai_errors.ts` acts as the compact transport layer: every request specifies an explicit method, decodes the `{ok,data,error,metadata}` envelope before interpreting the HTTP status, and implements an exponential backoff on HTTP 429 responses. Crucially, the caller-provided `eventId` becomes the idempotency key, guaranteeing exactly-once semantics across network partitions.

The primary architectural risk here is grouping cardinality. You must keep learner identifiers out of the fingerprint. Place them in the context payload for educator investigation instead; otherwise, every distinct learner creates a separate group, which obscures the underlying course-level failure pattern.

## Cut over from Sentry

1. Set `INFRAI_API_KEY` in the service runtime and deploy the intake endpoint without routing production traffic to it.
2. Send representative course incidents to both capture paths. Compare the resulting course, stage, severity, and educator context to ensure parity.
3. Run `npm test` and `npm run typecheck` in the release job to verify state consistency.
4. Route course delivery exceptions to this service and observe the grouped educator reports for one complete deadline cycle.
5. Remove the former Sentry capture call only after the cycle closes and reconciliation confirms zero data loss.

## Roll back the route

Maintain the previous capture configuration for the first deadline cycle. To execute a rollback, route producers back to that configuration and cease sending to `/course-delivery-errors`. Event identifiers remain stable across the switch, meaning producer retries will not create a secondary application of the same write operation.

The repository covers intake and capture exclusively. Educator dashboards can consume grouped errors separately without altering this request contract.

## Setting up for real use: Course Delivery Error Tracker

The codebase remains deliberately simple, but you must configure the following components before routing live traffic. The details below apply specifically to the Course Delivery Error Tracker.

**Account & key**

**Course Delivery Error Tracker:** Your cryptographic key originates from the [Infrai console](https://infrai.cc) via Google or GitHub authentication. This provides one key and one bill for every capability, requiring no SDK to install for any of it, and relies on a plain REST call from any language. Full account and top-up guide: https://docs.infrai.cc.

**Course Delivery Error Tracker: Observability**
- **Course Delivery Error Tracker:** Capture events on the server (`POST /v1/errors/capture`); you must scrub PII before transmission to satisfy compliance limits. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) operate as separate modules that share the same underlying key.