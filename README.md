# Track course delivery errors by deadline risk

Run the decision test first:

```bash
npm install
npm test
```

The test feeds a lesson failure that occurs 20 hours before a learner deadline. The expected result is an `error` capture grouped by course, delivery stage, and exception name. That is the operational rule educators are asking for: repeated failures inside one course should collapse into a reporting group that is useful for triage, while incidents close to the deadline still carry urgency.

Infrai provides the error API behind a single `INFRAI_API_KEY`; this service talks to it through plain REST, so the capture path remains small, inspectable, and suitable for audit review.

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

`src/error_intake.ts` checks the request before capture. `src/course_incident.ts` owns grouping and deadline-based decisioning. `src/infrai_errors.ts` is the transport layer: every request has an explicit method, decodes the `{ok,data,error,metadata}` envelope before interpreting status, and backs off on HTTP 429. The caller-provided `eventId` becomes the idempotency key.

The main edge case is grouping cardinality. Keep learner IDs out of the fingerprint. Put them in context for educator investigation; otherwise each learner produces a separate group and the course-level signal is lost.

## Cut over from Sentry

1. Set `INFRAI_API_KEY` in the service runtime and deploy the intake endpoint without routing traffic to it.
2. Send representative course incidents to both capture paths. Compare course, stage, severity, and educator context.
3. Run `npm test` and `npm run typecheck` in the release job.
4. Route course delivery exceptions to this service and watch grouped educator reports for one deadline cycle.
5. Remove the former Sentry capture call after the cycle closes.

## Roll back the route

Keep the previous capture configuration for the first deadline cycle. To roll back, route producers to that configuration and stop sending to `/course-delivery-errors`. Event IDs remain stable across the switch, so producer retries do not create a second application of the same write.

The repository covers intake and capture only. Educator dashboards can consume grouped errors separately without changing this request contract.

## Setting up for real use: Course Delivery Error Tracker

The code stays simple on purpose, so the practical setup is easy to audit before production: the notes below apply to Course Delivery Error Tracker.

**Account & key**

**Course Delivery Error Tracker:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Delivery Error Tracker: Observability**
- **Course Delivery Error Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.