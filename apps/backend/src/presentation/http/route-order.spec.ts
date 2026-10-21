import "reflect-metadata";
import { CandidatesController } from "./candidates.controller";
import { InterviewsController } from "./interviews.controller";
import { JobsController } from "./jobs.controller";
import { PersonasController } from "./personas.controller";
import { QuestionsController } from "./questions.controller";
import { ReportsController } from "./reports.controller";

// Nest matches routes in declaration order, so a literal GET path such as "notifications" must be declared
// before a catch-all like ":id", or the literal is swallowed and parsed as an id (a 500 on a uuid column).
const controllers: Array<[string, any]> = [
  ["candidates", CandidatesController],
  ["interviews", InterviewsController],
  ["jobs", JobsController],
  ["personas", PersonasController],
  ["questions", QuestionsController],
  ["reports", ReportsController],
];

const GET = 0; // RequestMethod.GET

describe("controller route order", () => {
  it.each(controllers)(
    "%s: literal GET paths are declared before single-segment :param paths",
    (_name, ctrl) => {
      const proto = ctrl.prototype;
      const routes = Object.getOwnPropertyNames(proto)
        .filter((k) => k !== "constructor" && typeof proto[k] === "function")
        .map((k) => ({
          k,
          method: Reflect.getMetadata("method", proto[k]),
          path: String(Reflect.getMetadata("path", proto[k]) ?? ""),
        }))
        .filter((r) => r.method === GET);

      routes.forEach((later, i) => {
        if (later.path.includes("/") || later.path.startsWith(":") || later.path === "") return;
        const shadowedBy = routes
          .slice(0, i)
          .find((r) => r.path.startsWith(":") && !r.path.includes("/"));
        expect({ route: later.path, shadowedBy: shadowedBy?.path }).toEqual({
          route: later.path,
          shadowedBy: undefined,
        });
      });
    },
  );
});
