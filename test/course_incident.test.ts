import assert from "node:assert/strict";
import test from "node:test";
import { courseIncidentSchema, decideCapture } from "../src/course_incident.js";

test("groups lesson failures and raises priority near a learner deadline", () => {
  const incident = courseIncidentSchema.parse({
    eventId: "evt-course-42-lesson-7",
    courseId: "course-42",
    deliveryStage: "lesson",
    learnerId: "learner-8",
    educatorId: "educator-3",
    deadlineAt: "2026-08-14T08:00:00.000Z",
    occurredAt: "2026-08-13T12:00:00.000Z",
    errorName: "LessonAssetError",
    errorMessage: "video manifest could not be loaded",
    stack: "LessonAssetError: video manifest could not be loaded"
  });

  assert.deepEqual(decideCapture(incident), {
    title: "course-42/lesson delivery failed",
    level: "error",
    fingerprint: ["course-42", "lesson", "LessonAssetError"],
    deadlineRisk: true
  });
});
