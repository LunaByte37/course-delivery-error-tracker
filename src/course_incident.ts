import { z } from "zod";

export const courseIncidentSchema = z.object({
  eventId: z.string().min(1),
  courseId: z.string().min(1),
  deliveryStage: z.enum(["enrollment", "lesson", "assessment", "submission"]),
  learnerId: z.string().min(1),
  educatorId: z.string().min(1),
  deadlineAt: z.string().datetime(),
  occurredAt: z.string().datetime(),
  errorName: z.string().min(1),
  errorMessage: z.string().min(1),
  stack: z.string().min(1)
});

export type CourseIncident = z.infer<typeof courseIncidentSchema>;

export type CaptureDecision = {
  title: string;
  level: "error" | "warning";
  fingerprint: string[];
  deadlineRisk: boolean;
};

export function decideCapture(incident: CourseIncident): CaptureDecision {
  const deadline = Date.parse(incident.deadlineAt);
  const occurred = Date.parse(incident.occurredAt);
  const deadlineRisk = deadline >= occurred && deadline - occurred <= 24 * 60 * 60 * 1000;

  return {
    title: `${incident.courseId}/${incident.deliveryStage} delivery failed`,
    level: deadlineRisk ? "error" : "warning",
    fingerprint: [incident.courseId, incident.deliveryStage, incident.errorName],
    deadlineRisk
  };
}
