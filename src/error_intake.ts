import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { courseIncidentSchema, decideCapture } from "./course_incident.js";
import { captureCourseError, InfraiError } from "./infrai_errors.js";

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/course-delivery-errors") {
    reply(response, 404, { error: "route not found" });
    return;
  }

  try {
    const incident = courseIncidentSchema.parse(await readBody(request));
    const decision = decideCapture(incident);
    const capture = await captureCourseError(
      {
        title: decision.title,
        message: incident.errorMessage,
        level: decision.level,
        fingerprint: decision.fingerprint,
        exception: incident.stack,
        context: {
          courseId: incident.courseId,
          learnerId: incident.learnerId,
          educatorId: incident.educatorId,
          deliveryStage: incident.deliveryStage,
          deadlineAt: incident.deadlineAt,
          deadlineRisk: decision.deadlineRisk
        }
      },
      incident.eventId
    );
    reply(response, 202, { captured: true, deadlineRisk: decision.deadlineRisk, capture });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      reply(response, 400, { error: "invalid request body" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      reply(response, error.status, { error: error.code, message: error.message });
      return;
    }
    reply(response, 500, { error: "capture failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`error intake listening on http://localhost:${port}`));
